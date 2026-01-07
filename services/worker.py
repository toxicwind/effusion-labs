"""
Arq Worker Configuration for Background Jobs
"""
import asyncio
from typing import Any

from arq import cron
from arq.connections import RedisSettings
import os

from services.scrapers.weedmaps import WeedmapsScraper
from services.scrapers.popmart import PopmartScraper

async def scrape_weedmaps_denver(ctx: dict[str, Any]) -> str:
    """
    Background job to scrape Weedmaps Denver dispensaries
    """
    print("Starting Weedmaps Denver scrape...")
    scraper = WeedmapsScraper()
    data = await scraper.scrape_denver()
    
    # In a real app, we would save 'data' to database here
    # ctx['redis'] might be used to store results
    
    return f"Scrape completed: {len(data)} dispensaries found"

async def scrape_popmart_recon(ctx: dict[str, Any]) -> str:
    """
    Background job for Popmart Recon
    """
    print("Starting Popmart Recon...")
    scraper = PopmartScraper()
    results = await scraper.run_recon_task({})
    
    count = results['summary']['discovered']
    if count > 0:
        print(f"🚨 ALERT: {count} new Popmart items discovered! Sending notifications...")
        # Here we would trigger Discord/Email notifications
    
    return f"Popmart Recon completed: {count} items found"

async def generate_cannabis_report(ctx: dict[str, Any], report_type: str = "daily") -> str:
    """
    Background job to generate cannabis market reports
    """
    print(f"Generating {report_type} cannabis report...")
    await asyncio.sleep(3)
    return f"{report_type} report generated"

async def startup(ctx: dict[str, Any]) -> None:
    """
    Startup function that runs when worker starts
    """
    print("Arq worker started")

async def shutdown(ctx: dict[str, Any]) -> None:
    """
    Shutdown function that runs when worker stops
    """
    print("Arq worker shutting down")

class WorkerSettings:
    """
    Arq worker settings
    """
    redis_settings = RedisSettings.from_dsn(
        os.getenv("REDIS_URL", "redis://localhost:6379/0")
    )
    
    functions = [
        scrape_weedmaps_denver,
        scrape_popmart_recon,
        generate_cannabis_report,
    ]
    
    cron_jobs = [
        cron(scrape_weedmaps_denver, hour=2, minute=0),  # Daily at 2 AM
        cron(scrape_popmart_recon, hour=4, minute=0),    # Daily at 4 AM
    ]
    
    on_startup = startup
    on_shutdown = shutdown
    
    max_jobs = 10
    job_timeout = 300  # 5 minutes
    keep_result = 3600  # Keep results for 1 hour
