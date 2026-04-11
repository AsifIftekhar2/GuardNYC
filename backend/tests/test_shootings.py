# Shooting data endpoint tests
import pytest
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('BACKEND_URL') or 'https://nyc-guard-ai.preview.emergentagent.com'
BASE_URL = BASE_URL.rstrip('/')

class TestShootingData:
    """Shooting data API tests"""

    def test_get_shootings_returns_data(self, api_client):
        """Test GET /shootings returns shooting data"""
        response = api_client.get(f"{BASE_URL}/api/shootings?limit=100")
        
        print(f"GET /shootings status: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "shootings" in data
        assert "count" in data
        assert isinstance(data["shootings"], list)
        assert data["count"] > 0, "Should have shooting data"
        
        # Validate structure of first shooting
        if data["shootings"]:
            shooting = data["shootings"][0]
            assert "latitude" in shooting
            assert "longitude" in shooting
            assert "boro" in shooting
            assert "occur_date" in shooting
            assert "_id" not in shooting, "MongoDB _id should be excluded"
        
        print(f"✓ GET /shootings returned {data['count']} records")

    def test_get_shootings_filter_by_boro(self, api_client):
        """Test filtering shootings by borough"""
        response = api_client.get(f"{BASE_URL}/api/shootings?boro=BROOKLYN&limit=50")
        
        print(f"Filter by boro status: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["count"] > 0, "Brooklyn should have shooting data"
        
        # Verify all results are from Brooklyn
        for shooting in data["shootings"]:
            assert shooting["boro"] == "BROOKLYN"
        
        print(f"✓ Borough filter working: {data['count']} Brooklyn records")

    def test_get_heatmap_data(self, api_client):
        """Test GET /shootings/heatmap returns heatmap points"""
        response = api_client.get(f"{BASE_URL}/api/shootings/heatmap?limit=1000")
        
        print(f"GET /heatmap status: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "points" in data
        assert "count" in data
        assert isinstance(data["points"], list)
        assert data["count"] > 0, "Should have heatmap points"
        
        # Validate point structure [lat, lng, intensity]
        if data["points"]:
            point = data["points"][0]
            assert isinstance(point, list)
            assert len(point) == 3
            assert isinstance(point[0], (int, float)), "Latitude should be numeric"
            assert isinstance(point[1], (int, float)), "Longitude should be numeric"
            assert isinstance(point[2], (int, float)), "Intensity should be numeric"
        
        print(f"✓ Heatmap returned {data['count']} points")
