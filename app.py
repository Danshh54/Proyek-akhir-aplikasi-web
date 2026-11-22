from flask import Flask, jsonify, redirect, render_template, request, url_for

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
    query = request.args.to_dict(flat=True)
    destination = url_for("index", **query) + "#hasil"
    return redirect(destination)


@app.route("/api/dashboard-data", methods=["GET"])
def dashboard_data():
    asal = request.args.get("asal", "").strip()
    tujuan = request.args.get("tujuan", "").strip()
    kelas = request.args.get("kelas", "").strip()

    if not asal or not tujuan or not kelas:
        return jsonify({"error": "Parameter asal, tujuan, dan kelas wajib diisi."}), 400
    if asal == tujuan:
        return jsonify({"error": "Kota asal dan tujuan harus berbeda."}), 400

    return jsonify(dm.get_dashboard_data(asal, tujuan, kelas))


@app.route("/chat")
def chat():
    return "Chat Flight-Smart"


if __name__ == "__main__":
    app.run(debug=True)
