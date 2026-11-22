from flask import Flask, render_template

from core.data_manager import FlightDataManager


app = Flask(__name__)
data_manager = FlightDataManager("data/Clean_Dataset.csv")


@app.route("/")
def index():
    return render_template(
        "index.html",
        stats=data_manager.get_global_stats(),
        source_cities=sorted(data_manager.data["source_city"].unique()),
        destination_cities=sorted(data_manager.data["destination_city"].unique()),
        classes=sorted(data_manager.data["class"].unique()),
    )


@app.route("/dashboard")
def dashboard():
    return "Dashboard Flight-Smart"


@app.route("/chat")
def chat():
    return "Chat Flight-Smart"


if __name__ == "__main__":
    app.run(debug=True)
