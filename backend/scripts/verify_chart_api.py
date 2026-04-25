import httpx
import json
import asyncio

async def test_chart_api():
    url = "http://localhost:8000/api/charts/data"
    params = {
        "symbol": "KOSPI",
        "indicators": "rsi,macd"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            print(f"Status Code: {response.status_code}")
            print(f"Symbol: {data['symbol']}")
            print(f"Data Points: {len(data['data'])}")
            
            if len(data['data']) > 0:
                first_point = data['data'][0]
                print(f"First Point: {json.dumps(first_point, indent=2)}")
                
                # Check for required fields
                required_fields = ['time', 'open', 'high', 'low', 'close']
                missing = [f for f in required_fields if f not in first_point]
                if missing:
                    print(f"ERROR: Missing fields: {missing}")
                else:
                    print("SUCCESS: All required fields present.")
                    
                # Check for indicators
                if 'indicators' in first_point and first_point['indicators']:
                    print(f"Indicators found: {list(first_point['indicators'].keys())}")
                else:
                    print("WARNING: Indicators not found in data point.")
                    
    except Exception as e:
        print(f"ERROR: API request failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_chart_api())
