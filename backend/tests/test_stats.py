# Statistics endpoint tests
import pytest
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('BACKEND_URL') or 'https://app-launch-241.preview.emergentagent.com'
BASE_URL = BASE_URL.rstrip('/')

class TestStats:
    """Statistics API tests"""

    def test_get_borough_stats(self, api_client):
        """Test GET /stats/boroughs returns borough statistics"""
        response = api_client.get(f"{BASE_URL}/api/stats/boroughs")
        
        print(f"GET /stats/boroughs status: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "stats" in data
        assert isinstance(data["stats"], list)
        assert len(data["stats"]) > 0, "Should have borough stats"
        
        # Validate structure
        for stat in data["stats"]:
            assert "boro" in stat
            assert "total" in stat
            assert "murders" in stat
            assert isinstance(stat["total"], int)
            assert isinstance(stat["murders"], int)
            assert stat["total"] >= stat["murders"], "Total should be >= murders"
        
        print(f"✓ Borough stats returned for {len(data['stats'])} boroughs")

    def test_get_time_distribution(self, api_client):
        """Test GET /stats/time-distribution returns time distribution"""
        response = api_client.get(f"{BASE_URL}/api/stats/time-distribution")
        
        print(f"GET /stats/time-distribution status: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "distribution" in data
        dist = data["distribution"]
        
        # Validate all time buckets present
        assert "00-06" in dist
        assert "06-12" in dist
        assert "12-18" in dist
        assert "18-24" in dist
        
        # Validate values are integers
        for bucket, count in dist.items():
            assert isinstance(count, int), f"Count for {bucket} should be integer"
            assert count >= 0
        
        total = sum(dist.values())
        print(f"✓ Time distribution: {total} total incidents across 4 time buckets")

    def test_get_yearly_stats(self, api_client):
        """Test GET /stats/yearly returns yearly statistics"""
        response = api_client.get(f"{BASE_URL}/api/stats/yearly")
        
        print(f"GET /stats/yearly status: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "stats" in data
        assert isinstance(data["stats"], list)
        assert len(data["stats"]) > 0, "Should have yearly stats"
        
        # Validate structure
        for stat in data["stats"]:
            assert "year" in stat
            assert "total" in stat
            assert isinstance(stat["year"], int)
            assert isinstance(stat["total"], int)
            assert stat["year"] >= 2000, "Year should be reasonable"
        
        print(f"✓ Yearly stats returned for {len(data['stats'])} years")
