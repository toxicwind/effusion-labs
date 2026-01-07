"""
Cannabis Analysis Service
Adapted from oneoff_cell.py to run as a reliable microservice

Features:
- Synthetic data generation (if no real data provided)
- Medical flower price analysis
- HTML report generation with plots
- JSON data endpoints
"""

import io
import base64
import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from fastapi import APIRouter, Response, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter(prefix="/cannabis", tags=["cannabis"])

# --- Data Generation ---

def generate_synthetic_data(n_products=150):
    """Generate realistic-looking cannabis price data"""
    np.random.seed(42)  # Deterministic for demo
    
    categories = ['Bulk Value', 'Pre-Pack Specialty', 'Shake/Popcorn/Trim', 'Premium Flower', 'Small Batch']
    sizes = ['3.5g', '7g', '14g', '28g']
    weights = [3.5, 7.0, 14.0, 28.0]
    
    data = []
    for _ in range(n_products):
        cat = np.random.choice(categories)
        size_idx = np.random.choice(range(len(sizes)))
        size_label = sizes[size_idx]
        weight_g = weights[size_idx]
        
        # Base price per gram roughly based on category
        base_ppg = {
            'Bulk Value': 5.0,
            'Pre-Pack Specialty': 12.0,
            'Shake/Popcorn/Trim': 3.5,
            'Premium Flower': 15.0,
            'Small Batch': 18.0
        }[cat]
        
        # Add noise
        ppg = base_ppg * np.random.normal(1.0, 0.15)
        price = round(ppg * weight_g)
        
        # Ensure logical price
        price = max(10, price)
        
        # Calc per oz
        price_per_oz = (price / weight_g) * 28.0
        
        data.append({
            'name': f"Strain {np.random.randint(100, 999)} {cat}",
            'slug': f"strain-{np.random.randint(100, 999)}",
            'report_category': cat,
            'size_label': size_label,
            'weight_g': weight_g,
            'price': price,
            'price_per_oz': price_per_oz
        })
        
    return pd.DataFrame(data)

# --- Analysis Logic (Adapted from oneoff_cell.py) ---

def run_analysis(df: pd.DataFrame, dispensary_name: str = "Demo Dispensary"):
    """Run full analysis pipeline and return HTML report"""
    
    # 1. Config & Styling
    sns.set_theme(style="whitegrid")
    
    # Categories order
    cat_order = (
        df.groupby('report_category')['price_per_oz']
        .median()
        .sort_values()
        .index
        .tolist()
    )
    
    # 2. Plots
    def _encode_fig(fig, dpi=100):
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=dpi, bbox_inches='tight')
        plt.close(fig)
        return base64.b64encode(buf.getvalue()).decode('utf-8')

    # Box Plot
    fig1, ax1 = plt.subplots(figsize=(10, 5))
    sns.boxplot(
        data=df, x="price_per_oz", y="report_category",
        order=cat_order, hue="report_category",
        palette="pastel", legend=False, ax=ax1,
        fliersize=5, linewidth=1.2
    )
    ax1.set_title("Price Distribution by Product Type")
    img_box = _encode_fig(fig1)
    
    # ECDF
    fig2, ax2 = plt.subplots(figsize=(10, 5))
    sns.ecdfplot(
        data=df, x="price_per_oz", hue="report_category",
        hue_order=cat_order, palette="Set2", legend=True, ax=ax2
    )
    ax2.set_title("Cumulative Distribution")
    img_ecdf = _encode_fig(fig2)
    
    # 3. Metrics
    best_row = df.loc[df['price_per_oz'].idxmin()]
    metrics = {
        "best_ppoz": best_row['price_per_oz'],
        "best_name": best_row['name'],
        "median_price": df['price_per_oz'].median(),
        "under_60_pct": (df['price_per_oz'] <= 60).mean() * 100
    }
    
    # 4. Generate HTML (Simplified for API speed, but capturing the essence)
    html = f"""
    <!DOCTYPE html>
    <html class="dark">
    <head>
        <meta charset="utf-8">
        <title>Cannabis Price Analysis</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>body {{ font-family: system-ui, sans-serif; }}</style>
    </head>
    <body class="bg-gray-900 text-gray-100 p-8 max-w-5xl mx-auto">
        <header class="mb-10 text-center">
            <h1 class="text-4xl font-bold text-emerald-400">Analysis Report: {dispensary_name}</h1>
            <p class="text-gray-400 mt-2">Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
        </header>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            <div class="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div class="text-gray-400 text-sm">Best Value (28g eq)</div>
                <div class="text-3xl font-bold text-emerald-400">${metrics['best_ppoz']:.2f}/oz</div>
                <div class="text-sm text-gray-500 mt-1">{metrics['best_name']}</div>
            </div>
            <div class="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div class="text-gray-400 text-sm">Market Median</div>
                <div class="text-3xl font-bold text-white">${metrics['median_price']:.0f}/oz</div>
                <div class="text-sm text-gray-500 mt-1">Typical price point</div>
            </div>
            <div class="bg-gray-800 p-6 rounded-xl border border-gray-700">
                <div class="text-gray-400 text-sm">Budget Coverage (≤$60)</div>
                <div class="text-3xl font-bold text-blue-400">{metrics['under_60_pct']:.0f}%</div>
                <div class="text-sm text-gray-500 mt-1">Products under $60/oz eq</div>
            </div>
        </div>
        
        <h2 class="text-2xl font-semibold text-emerald-400 mb-6 border-b border-gray-700 pb-2">Visualizations</h2>
        
        <div class="space-y-8">
            <div class="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <h3 class="text-lg font-medium mb-4">Price Distribution by Category</h3>
                <img src="data:image/png;base64,{img_box}" class="w-full rounded bg-white p-2">
            </div>
            
            <div class="bg-gray-800 p-4 rounded-xl border border-gray-700">
                <h3 class="text-lg font-medium mb-4">Cumulative Market Distribution</h3>
                <img src="data:image/png;base64,{img_ecdf}" class="w-full rounded bg-white p-2">
            </div>
        </div>
        
        <footer class="mt-12 text-center text-gray-600 text-sm">
            Powered by Effusion Labs Orchestrator
        </footer>
    </body>
    </html>
    """
    
    return html

# --- Endpoints ---

@router.get("/report/demo", response_class=Response)
async def get_demo_report():
    """Get a full HTML analysis report using synthetic data"""
    df = generate_synthetic_data()
    html_content = run_analysis(df, "Synthetic Demo Data")
    return Response(content=html_content, media_type="text/html")

@router.post("/report")
async def generate_report(data: List[dict]):
    """Generate report from posted JSON data"""
    df = pd.DataFrame(data)
    # Basic validation
    required = {'name', 'price', 'weight_g'}
    if not required.issubset(df.columns):
        return {"error": f"Missing columns. Required: {required}"}
        
    if 'price_per_oz' not in df.columns:
        df['price_per_oz'] = (df['price'] / df['weight_g']) * 28.0
        
    if 'report_category' not in df.columns:
        df['report_category'] = 'Unspecified'
        
    html_content = run_analysis(df, "Custom Data Input")
    return Response(content=html_content, media_type="text/html")

@router.get("/data/synthetic")
async def get_synthetic_data():
    """Get raw synthetic data for frontend visualization"""
    df = generate_synthetic_data(50)
    return df.to_dict(orient="records")
