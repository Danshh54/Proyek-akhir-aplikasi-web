from flask import Flask, jsonify, render_template, request
import pandas as pd

from core.data_manager import FlightDataManager


app = Flask(__name__)
dm = FlightDataManager("data/Clean_Dataset.csv")
data_manager = dm


@app.route("/")
def index():
    return render_template(
        "index.html",
        stats=dm.get_global_stats(),
        source_cities=sorted(dm.data["source_city"].unique()),
        destination_cities=sorted(dm.data["destination_city"].unique()),
        classes=sorted(dm.data["class"].unique()),
        selected_asal=request.args.get("asal", ""),
        selected_tujuan=request.args.get("tujuan", ""),
        selected_kelas=request.args.get("kelas", ""),
    )


@app.route("/dashboard")
def dashboard():
    selected_asal = request.args.get("asal", "")
    selected_tujuan = request.args.get("tujuan", "")
    selected_kelas = request.args.get("kelas", "")
    if not any((selected_asal, selected_tujuan, selected_kelas)):
        preferred = ("Delhi", "Mumbai", "Economy")
        valid = dm.data[
            (dm.data["source_city"] == preferred[0])
            & (dm.data["destination_city"] == preferred[1])
            & (dm.data["class"] == preferred[2])
        ]
        if valid.empty:
            preferred = tuple(dm.data[["source_city", "destination_city", "class"]].drop_duplicates().iloc[0])
        selected_asal, selected_tujuan, selected_kelas = preferred

    return render_template(
        "dashboard.html",
        source_cities=sorted(dm.data["source_city"].unique()),
        destination_cities=sorted(dm.data["destination_city"].unique()),
        classes=sorted(dm.data["class"].unique()),
        selected_asal=selected_asal,
        selected_tujuan=selected_tujuan,
        selected_kelas=selected_kelas,
    )


@app.route("/api/dashboard-data", methods=["GET"])
def dashboard_data():
    asal = request.args.get("asal", "").strip()
    tujuan = request.args.get("tujuan", "").strip()
    kelas = request.args.get("kelas", "").strip()

    if not asal or not tujuan or not kelas:
        return jsonify({"error": "Parameter asal, tujuan, dan kelas wajib diisi."}), 400
    if asal == tujuan:
        return jsonify({"error": "Kota asal dan tujuan harus berbeda."}), 400

    result = dm.get_dashboard_data(asal, tujuan, kelas)
    frame = dm.data[
        (dm.data["source_city"] == asal)
        & (dm.data["destination_city"] == tujuan)
        & (dm.data["class"] == kelas)
    ]
    departure_order = ["Early_Morning", "Morning", "Afternoon", "Evening", "Night", "Late_Night"]
    departure = frame.groupby("departure_time", as_index=False)["price"].mean()
    departure["departure_time"] = pd.Categorical(
        departure["departure_time"], categories=departure_order, ordered=True
    )
    departure = departure.sort_values("departure_time")
    result["chart"]["rata_rata_jam_berangkat"] = departure.rename(
        columns={"departure_time": "jam_berangkat", "price": "harga"}
    ).to_dict("records")
    return jsonify(result)


@app.route("/chat")
def chat():
    return "Chat Flight-Smart"


if __name__ == "__main__":
    app.run(debug=True)
