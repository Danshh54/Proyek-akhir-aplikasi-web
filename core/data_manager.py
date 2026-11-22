"""Pemrosesan data, analitik, dan model prediksi Flight-Smart."""

from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.cluster import KMeans


class FlightDataManager:
    """Menyediakan data ringkasan dan prediksi harga tiket pesawat."""

    CATEGORICAL_COLUMNS = [
        "airline",
        "flight",
        "source_city",
        "departure_time",
        "stops",
        "arrival_time",
        "destination_city",
        "class",
    ]
    NUMERICAL_COLUMNS = ["duration", "days_left"]
    CLUSTER_NAMES = [
        "Kluster 0: Early-Bird Hemat",
        "Kluster 1: Reguler Fleksibel",
        "Kluster 2: Premium / Last-Minute Surge",
    ]

    def __init__(self, data_path: Optional[str] = None) -> None:
        path = Path(data_path) if data_path else Path(__file__).resolve().parents[1] / "data" / "Clean_Dataset.csv"
        self.data = pd.read_csv(path)
        self.data = self.data.drop(columns=["Unnamed: 0"], errors="ignore")
        self._validate_columns()

        # Setiap kombinasi rute dan kelas mendapat jumlah data yang sama.
        self.data = (
            self.data.groupby(["source_city", "destination_city", "class"], group_keys=False)
            .sample(n=250, random_state=42)
            .reset_index(drop=True)
        )
        self._add_clusters()
        self._train_model()

    def _validate_columns(self) -> None:
        required = set(self.CATEGORICAL_COLUMNS + self.NUMERICAL_COLUMNS + ["price"])
        missing = required.difference(self.data.columns)
        if missing:
            raise ValueError(f"Kolom dataset tidak lengkap: {sorted(missing)}")

    def _add_clusters(self) -> None:
        features = self.data[["price", "duration", "days_left"]]
        scaled = StandardScaler().fit_transform(features)
        raw_labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(scaled)

        means = self.data.assign(_cluster=raw_labels).groupby("_cluster")["price"].mean()
        ordered = {old: new for new, old in enumerate(means.sort_values().index)}
        labels = pd.Series(raw_labels, index=self.data.index).map(ordered)
        self.data["Kluster"] = labels.map(dict(enumerate(self.CLUSTER_NAMES)))

    def _train_model(self) -> None:
        self.preprocessor = ColumnTransformer(
            transformers=[
                ("categorical", OneHotEncoder(handle_unknown="ignore"), self.CATEGORICAL_COLUMNS),
                ("numerical", "passthrough", self.NUMERICAL_COLUMNS),
            ]
        )
        self.model = Pipeline(
            steps=[
                ("preprocessor", self.preprocessor),
                ("regressor", RandomForestRegressor(
                    n_estimators=40, max_depth=14, random_state=42, n_jobs=-1
                )),
            ]
        )
        self.model.fit(self.data[self.CATEGORICAL_COLUMNS + self.NUMERICAL_COLUMNS], self.data["price"])

    @staticmethod
    def _mean(frame: pd.DataFrame, fallback: float = 0.0) -> float:
        return float(frame["price"].mean()) if not frame.empty else float(fallback)

    @staticmethod
    def _savings(reference: float, comparison: float) -> float:
        return round(max(0.0, (reference - comparison) / reference * 100), 2) if reference else 0.0

    def get_global_stats(self) -> Dict[str, Any]:
        safe = self.data[self.data["days_left"].between(15, 35)]
        last_minute = self.data[self.data["days_left"].between(1, 3)]
        safe_price = self._mean(safe)
        urgent_price = self._mean(last_minute)
        return {
            "total_rute": int(self.data[["source_city", "destination_city"]].drop_duplicates().shape[0]),
            "total_sampel": int(len(self.data)),
            "rata_rata_penghematan_persen": self._savings(urgent_price, safe_price),
            "tarif_termurah": float(self.data["price"].min()),
        }

    def _filtered(self, asal: str, tujuan: str, kelas: str) -> pd.DataFrame:
        return self.data[
            (self.data["source_city"] == asal)
            & (self.data["destination_city"] == tujuan)
            & (self.data["class"] == kelas)
        ]

    def get_dashboard_data(self, asal: str, tujuan: str, kelas: str) -> Dict[str, Any]:
        frame = self._filtered(asal, tujuan, kelas)
        urgent = self._mean(frame[frame["days_left"].between(1, 3)])
        safe = self._mean(frame[frame["days_left"].between(15, 35)])

        trend = frame.groupby("days_left", as_index=False)["price"].mean()
        trend = trend[trend["days_left"].between(1, 49)].sort_values("days_left", ascending=False)
        airline = frame.groupby("airline", as_index=False)["price"].mean().sort_values("price")
        clusters = frame["Kluster"].value_counts().reindex(self.CLUSTER_NAMES, fill_value=0)

        # Cari jendela lima hari dengan rata-rata harga terendah.
        windows = []
        for start in range(1, 46):
            values = frame[frame["days_left"].between(start, start + 4)]["price"]
            if not values.empty:
                windows.append((values.mean(), start, start + 4))
        if windows:
            _, start, end = min(windows)
            safe_window = {"start": int(start), "end": int(end), "label": f"H-{end} s/d H-{start}"}
        else:
            safe_window = {"start": None, "end": None, "label": "Data tidak tersedia"}

        return {
            "summary": {
                "harga_dadakan": round(urgent, 2),
                "harga_aman": round(safe, 2),
                "persentase_hemat": self._savings(urgent, safe),
                "waktu_aman_beli": safe_window,
            },
            "chart": {
                "tren_harga": trend.rename(columns={"days_left": "days_left", "price": "harga"}).to_dict("records"),
                "rata_rata_airline": airline.rename(columns={"price": "harga"}).to_dict("records"),
                "distribusi_kluster": [
                    {"kluster": name, "jumlah": int(count)} for name, count in clusters.items()
                ],
            },
        }

    def simulate_safe_booking(
        self, asal: str, tujuan: str, airline: str, kelas: str, stops: str, days_left: int
    ) -> Dict[str, Any]:
        route = self._filtered(asal, tujuan, kelas)
        matching = route[(route["airline"] == airline) & (route["stops"] == stops)]
        source = matching if not matching.empty else route
        if source.empty:
            raise ValueError("Kombinasi rute, kelas, airline, atau stops tidak ditemukan")

        # Beberapa atribut kategorikal tidak diminta pada simulasi; gunakan nilai modus.
        row = {column: source[column].mode().iloc[0] for column in self.CATEGORICAL_COLUMNS}
        row.update({"airline": airline, "source_city": asal, "destination_city": tujuan,
                    "class": kelas, "stops": stops, "days_left": int(days_left),
                    "duration": float(source["duration"].median())})
        predicted = float(self.model.predict(pd.DataFrame([row]))[0])

        benchmark_source = matching if not matching.empty else route
        benchmark_rows = benchmark_source[benchmark_source["days_left"] == 25]
        safe_rows = benchmark_source[benchmark_source["days_left"].between(15, 35)]
        benchmark = self._mean(benchmark_rows if not benchmark_rows.empty else safe_rows)
        return {
            "prediksi_harga": round(predicted, 2),
            "benchmark_h25": round(benchmark, 2),
            "selisih_penghematan": round(benchmark - predicted, 2),
            "persentase_penghematan": self._savings(benchmark, predicted),
            "days_left": int(days_left),
        }
