import os
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MinMaxScaler

# =====================================================
# Helper: Generate a rich mock dataset if missing
# =====================================================
def generate_rich_mock_data(csv_path="zomato_sample.csv"):
    """
    Generates a realistic mock restaurant dataset with 150 entries
    spread across various global cities and popular cuisines.
    """
    import random
    
    cities = ["Bangalore", "Mumbai", "Delhi", "New York", "London", "Tokyo", "Paris"]
    localities = {
        "Bangalore": ["Indiranagar", "Koramangala", "HSR Layout", "Jayanagar", "Whitefield"],
        "Mumbai": ["Bandra West", "Juhu", "Colaba", "Andheri West", "Lower Parel"],
        "Delhi": ["Connaught Place", "Saket", "Rajouri Garden", "Hauz Khas", "Karol Bagh"],
        "New York": ["Manhattan", "Brooklyn", "Queens", "Soho", "Astoria"],
        "London": ["Covent Garden", "Soho", "Camden", "Kensington", "Shoreditch"],
        "Tokyo": ["Shibuya", "Shinjuku", "Ginza", "Roppongi", "Akihabara"],
        "Paris": ["Le Marais", "Montmartre", "Latin Quarter", "Saint-Germain", "Bastille"]
    }
    
    cuisines_list = [
        "Indian, North Indian, Mughlai",
        "Italian, Pizza, Pasta",
        "Japanese, Sushi, Ramen",
        "Mexican, Tacos, Quesadillas",
        "American, Burgers, Fast Food",
        "Chinese, Asian, Dumplings",
        "French, Bakery, Cafe",
        "Mediterranean, Greek, Falafel",
        "Thai, Asian, Curry",
        "Continental, Seafood, Steak"
    ]
    
    restaurant_prefixes = [
        "The Golden", "Mamma Mia", "Sakura", "El Taco", "Burger", "Le Petit",
        "Mediterranean", "Wok &", "Spicy", "Royal", "Urban", "Gourmet", "Tandoori",
        "Bella", "Little", "Epicurean", "Bistro", "Grand", "House of"
    ]
    
    restaurant_suffixes = [
        "Curry", "Pizzeria", "Zen", "Loco", "Joint", "Bistro", "Breeze", "Roll",
        "Sichuan", "Palace", "Kitchen", "Hub", "Nights", "Vista", "Italy", "Shack",
        "Garden", "Chopsticks", "Plaza", "Tavern"
    ]
    
    random.seed(42)  # For reproducibility
    data = []
    
    for i in range(1, 151):
        city = random.choice(cities)
        locality = random.choice(localities[city])
        
        # Pick cuisine and generate matching restaurant name
        cuisine_idx = random.randint(0, len(cuisines_list) - 1)
        cuisine = cuisines_list[cuisine_idx]
        
        prefix = random.choice(restaurant_prefixes)
        suffix = random.choice(restaurant_suffixes)
        name = f"{prefix} {suffix}"
        
        # Adjust name to match cuisine sometimes for realistic similarities
        if "Indian" in cuisine and random.random() > 0.4:
            name = random.choice(["Taj Mahal Dining", "The Curry Club", "Spice Route", "Tandoori Mahal", "Bombay Grill", "Chutney Savor", "Nirvana Indian Cuisine"])
        elif "Italian" in cuisine and random.random() > 0.4:
            name = random.choice(["La Piazza", "Trattoria Romana", "Pizza Bella", "Pasta Fresca", "Gusto Italiano", "Luigi's Pizzeria"])
        elif "Japanese" in cuisine and random.random() > 0.4:
            name = random.choice(["Sushi Bar Zen", "Tokyo Ramen House", "Kyoto Garden", "Oishi Sushi", "Izakaya Tokyo", "Ramen Shogun"])
        elif "Mexican" in cuisine and random.random() > 0.4:
            name = random.choice(["Taco Fiesta", "Casa de Taco", "Cantina Mexicana", "El Sombrero", "Salsa & Guac"])
        elif "Chinese" in cuisine and random.random() > 0.4:
            name = random.choice(["Great Wall Buffet", "Golden Dragon", "Peking Wok", "Dynasty Chinese", "Red Lotus House"])
            
        rating = round(random.uniform(3.0, 4.9), 1)
        votes = random.randint(15, 1200)
        cost = random.randint(15, 150) * 20  # Cost for two
        
        # Make sure names are unique in our dataset to avoid indexing issues
        existing_names = [d["name"] for d in data]
        if name in existing_names:
            name = f"{name} ({locality})"
            
        data.append({
            "restaurant_id": i,
            "name": name,
            "city": city,
            "locality": locality,
            "cuisines": cuisine,
            "aggregate_rating": rating,
            "votes": votes,
            "cost_for_two": cost
        })
        
    df = pd.DataFrame(data)
    df.to_csv(csv_path, index=False)
    print(f"Generated rich mock dataset at {csv_path} with {len(df)} entries.")
    return df


# =====================================================
# 1. Load data
# =====================================================
def load_data(csv_path="zomato.csv"):
    """
    Loads restaurant CSV dataset. If missing, automatically generates
    a rich mock sample file and loads it instead.
    """
    if not os.path.exists(csv_path):
        if csv_path == "zomato.csv" or csv_path == "zomato_sample.csv":
            print(f"File {csv_path} not found. Generating a default rich sample dataset...")
            csv_path = "zomato_sample.csv"
            if not os.path.exists(csv_path):
                generate_rich_mock_data(csv_path)
        else:
            raise FileNotFoundError(f"Requested dataset path '{csv_path}' does not exist.")
            
    df = pd.read_csv(csv_path)
    
    # Rename columns to match expectations if slightly different (e.g. from Kaggle)
    col_mapping = {
        'Restaurant ID': 'restaurant_id',
        'Restaurant Name': 'name',
        'City': 'city',
        'Locality': 'locality',
        'Cuisines': 'cuisines',
        'Aggregate rating': 'aggregate_rating',
        'Votes': 'votes',
        'Average Cost for two': 'cost_for_two'
    }
    df.rename(columns={k: v for k, v in col_mapping.items() if k in df.columns}, inplace=True)
    
    # Drop rows missing crucial values
    required_cols = ["name", "cuisines", "aggregate_rating"]
    for col in required_cols:
        if col not in df.columns:
            # If the column is missing in user CSV, handle it gracefully
            if col == "aggregate_rating" and "rating" in df.columns:
                df.rename(columns={"rating": "aggregate_rating"}, inplace=True)
            elif col == "cuisines" and "cuisine" in df.columns:
                df.rename(columns={"cuisine": "cuisines"}, inplace=True)
            else:
                raise ValueError(f"Required column '{col}' is missing from the dataset. Found: {list(df.columns)}")
                
    df = df.dropna(subset=["name", "cuisines", "aggregate_rating"])
    df["cuisines"] = df["cuisines"].fillna("")
    df["locality"] = df["locality"].fillna("")
    df["city"] = df["city"].fillna("Unknown")
    
    # Ensure votes exists
    if "votes" not in df.columns:
        df["votes"] = 0
    else:
        df["votes"] = df["votes"].fillna(0).astype(int)
        
    if "cost_for_two" not in df.columns:
        df["cost_for_two"] = 0
    else:
        df["cost_for_two"] = df["cost_for_two"].fillna(0).astype(int)
        
    df.reset_index(drop=True, inplace=True)
    return df


# =====================================================
# 3. Content-Based Filtering (cuisine + locality text similarity)
# =====================================================
class ContentBasedRecommender:
    def __init__(self, df):
        self.df = df.copy()
        # Combine cuisines, locality, and city text for TF-IDF similarity
        self.df["combined_features"] = (
            self.df["cuisines"] + " " + self.df["locality"] + " " + self.df["city"]
        )
        self.vectorizer = TfidfVectorizer(stop_words="english")
        self.tfidf_matrix = self.vectorizer.fit_transform(self.df["combined_features"])
        self.similarity_matrix = cosine_similarity(self.tfidf_matrix)

    def recommend(self, restaurant_name, top_n=10):
        # Case insensitive match
        matches = self.df[self.df["name"].str.lower() == restaurant_name.lower()]
        if matches.empty:
            # Try a partial match if exact match fails
            matches = self.df[self.df["name"].str.lower().str.contains(restaurant_name.lower())]
            if matches.empty:
                return pd.DataFrame()
                
        idx = matches.index[0]
        scores = list(enumerate(self.similarity_matrix[idx]))
        
        # Sort by similarity score descending, skip the first one since it's the restaurant itself
        scores = sorted(scores, key=lambda x: x[1], reverse=True)
        
        # Filter out the exact same restaurant from recommendations if there are other matches
        filtered_scores = [item for item in scores if self.df.iloc[item[0]]["name"].lower() != restaurant_name.lower()]
        
        # Take top N
        top_scores = filtered_scores[:top_n]
        indices = [i for i, _ in top_scores]
        similarities = [score for _, score in top_scores]
        
        result_df = self.df.iloc[indices].copy()
        result_df["similarity_score"] = similarities
        return result_df[["name", "city", "locality", "cuisines", "aggregate_rating", "similarity_score", "votes", "cost_for_two"]]


# =====================================================
# 4. Rating/Popularity-Based Scoring (used to re-rank)
# =====================================================
def compute_popularity_score(df):
    scaler = MinMaxScaler()
    df = df.copy()
    
    # Handle edge case where all ratings/votes are the same
    if len(df) <= 1:
        df["norm_rating"] = 1.0
        df["norm_votes"] = 1.0
    else:
        # Scale ratings and votes
        df[["norm_rating", "norm_votes"]] = scaler.fit_transform(
            df[["aggregate_rating", "votes"]]
        )
        
    # weighted score: rating matters more, votes add confidence
    df["popularity_score"] = 0.7 * df["norm_rating"] + 0.3 * df["norm_votes"]
    return df


# =====================================================
# 5. Hybrid Recommender
# =====================================================
class HybridRecommender:
    def __init__(self, df):
        self.df = compute_popularity_score(df)
        self.content_model = ContentBasedRecommender(self.df)

    def recommend_by_filters(self, cuisine=None, city=None, locality=None,
                              min_rating=0.0, max_cost=None, top_n=10):
        filtered = self.df.copy()

        if cuisine:
            filtered = filtered[filtered["cuisines"].str.contains(cuisine, case=False, na=False)]
        if city:
            filtered = filtered[filtered["city"].str.lower() == city.lower()]
        if locality:
            filtered = filtered[filtered["locality"].str.contains(locality, case=False, na=False)]
        if max_cost:
            filtered = filtered[filtered["cost_for_two"] <= max_cost]

        filtered = filtered[filtered["aggregate_rating"] >= min_rating]

        if filtered.empty:
            return pd.DataFrame()

        # Final hybrid score = popularity score (when no seed restaurant is selected)
        filtered = filtered.sort_values("popularity_score", ascending=False)
        return filtered.head(top_n)[
            ["name", "city", "locality", "cuisines", "aggregate_rating", "votes", "cost_for_two", "popularity_score"]
        ]

    def recommend_similar(self, restaurant_name, top_n=10, content_weight=0.6):
        """Hybrid: blend content similarity with popularity score."""
        # Query 3x top_n content-similar candidates to allow reranking with popularity
        similar = self.content_model.recommend(restaurant_name, top_n=top_n * 3)
        if similar.empty:
            return pd.DataFrame()

        # Merge with popularity score from original df
        merged = similar.merge(
            self.df[["name", "popularity_score"]], on="name", how="left"
        )
        merged["popularity_score"] = merged["popularity_score"].fillna(0.0)
        
        # normalize rank-based content score (position in list -> score)
        merged["content_score"] = np.linspace(1, 0, len(merged))
        merged["hybrid_score"] = (
            content_weight * merged["content_score"]
            + (1 - content_weight) * merged["popularity_score"]
        )
        merged = merged.sort_values("hybrid_score", ascending=False)
        return merged.head(top_n)[
            ["name", "city", "locality", "cuisines", "aggregate_rating", "votes", "cost_for_two", "hybrid_score"]
        ]


# =====================================================
# Demo/Verification main block
# =====================================================
if __name__ == "__main__":
    # Generate and test recommender
    df = load_data("zomato_sample.csv")
    recommender = HybridRecommender(df)

    print("=== Unique Cities available ===")
    print(df["city"].unique())

    print("\n=== Recommend by filters (cuisine='Indian', min_rating=4.0) ===")
    print(recommender.recommend_by_filters(cuisine="Indian", min_rating=4.0, top_n=5))

    # Pick the first restaurant to find similar ones
    first_restaurant = df.iloc[0]["name"]
    print(f"\n=== Recommend similar to '{first_restaurant}' (hybrid) ===")
    print(recommender.recommend_similar(first_restaurant, top_n=5))
