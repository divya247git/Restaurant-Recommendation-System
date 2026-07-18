import os
from flask import Flask, jsonify, request, send_from_directory
import pandas as pd
from recommender import load_data, HybridRecommender, generate_rich_mock_data

app = Flask(__name__, static_folder='static', static_url_path='')

# Determine which CSV to load (defaulting to zomato_sample.csv if zomato.csv is absent)
csv_path = "zomato.csv" if os.path.exists("zomato.csv") else "zomato_sample.csv"

# Global data frames and hybrid recommender reference
df = None
recommender = None

def init_recommender(path):
    global df, recommender, csv_path
    try:
        df = load_data(path)
        csv_path = path
        recommender = HybridRecommender(df)
        print(f"Model trained successfully with {len(df)} restaurants from '{csv_path}'.")
    except Exception as e:
        print(f"Error loading {path}: {e}")
        # If it fails, fallback to generating sample data
        if path != "zomato_sample.csv":
            print("Falling back to zomato_sample.csv...")
            init_recommender("zomato_sample.csv")
        else:
            raise RuntimeError(f"Failed to initialize recommender with any dataset: {e}")

# Initialize on start
init_recommender(csv_path)

@app.route('/')
def index():
    """Serves the main single page application."""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/config')
def get_config():
    """Returns dataset stats, available cities, cuisines, and localities."""
    global df, csv_path
    cities = sorted(df["city"].unique().tolist())
    
    # Gather all unique cuisines (handling multi-value commas)
    all_cuisines = set()
    for cuisines in df["cuisines"].dropna():
        for c in cuisines.split(','):
            all_cuisines.add(c.strip())
    cuisines_list = sorted(list(all_cuisines))
    
    # Map city -> unique localities
    localities_by_city = {}
    for city in df["city"].unique():
        localities_by_city[city] = sorted(df[df["city"] == city]["locality"].unique().tolist())
        
    return jsonify({
        "num_records": len(df),
        "cities": cities,
        "cuisines": cuisines_list,
        "localities_by_city": localities_by_city,
        "current_dataset": os.path.basename(csv_path)
    })

@app.route('/api/restaurants')
def get_restaurants():
    """Filters restaurants by parameters and returns them ordered by popularity."""
    global recommender
    cuisine = request.args.get('cuisine')
    city = request.args.get('city')
    locality = request.args.get('locality')
    min_rating = float(request.args.get('min_rating', 0.0))
    max_cost = request.args.get('max_cost')
    
    if max_cost:
        try:
            max_cost = int(max_cost)
        except ValueError:
            max_cost = None
            
    top_n = int(request.args.get('top_n', 16))
    
    # Use recommender's filter function
    results_df = recommender.recommend_by_filters(
        cuisine=cuisine,
        city=city,
        locality=locality,
        min_rating=min_rating,
        max_cost=max_cost,
        top_n=top_n
    )
    
    if results_df.empty:
        return jsonify([])
        
    results = results_df.to_dict(orient='records')
    return jsonify(results)

@app.route('/api/recommend_similar')
def get_similar():
    """Finds content-similar restaurants re-ranked by collaborative/popularity scores."""
    global recommender
    restaurant_name = request.args.get('name')
    if not restaurant_name:
        return jsonify({"error": "Query parameter 'name' is required."}), 400
        
    top_n = int(request.args.get('top_n', 8))
    content_weight = float(request.args.get('content_weight', 0.6))
    
    similar_df = recommender.recommend_similar(
        restaurant_name, 
        top_n=top_n, 
        content_weight=content_weight
    )
    
    if similar_df.empty:
        return jsonify([])
        
    results = similar_df.to_dict(orient='records')
    return jsonify(results)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Accepts a custom zomato.csv, re-trains TF-IDF matrices and refreshes recommendation engine."""
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded in form field 'file'."}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected."}), 400
        
    if file and file.filename.endswith('.csv'):
        filename = "zomato_uploaded.csv"
        # Save to main project folder
        file_path = os.path.join(os.getcwd(), filename)
        file.save(file_path)
        try:
            init_recommender(file_path)
            return jsonify({
                "success": True, 
                "message": "Dataset uploaded and recommender re-trained successfully!",
                "num_records": len(df),
                "dataset_name": file.filename
            })
        except Exception as e:
            return jsonify({"error": f"Failed to process CSV or re-train model: {str(e)}"}), 500
    else:
        return jsonify({"error": "Unsupported file format. Please upload a valid CSV file."}), 400

if __name__ == '__main__':
    # Start local server on port 5000
    app.run(host='0.0.0.0', port=5000, debug=True)
