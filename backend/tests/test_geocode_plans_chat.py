# Geocode, Plans, and Chat endpoint tests
import pytest
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('BACKEND_URL') or 'https://nyc-guard-ai.preview.emergentagent.com'
BASE_URL = BASE_URL.rstrip('/')

class TestGeocode:
    """Geocode API tests"""

    def test_geocode_times_square(self, api_client):
        """Test geocoding Times Square"""
        response = api_client.get(f"{BASE_URL}/api/geocode?q=Times+Square")
        
        print(f"Geocode Times Square status: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "latitude" in data
        assert "longitude" in data
        assert "query" in data
        
        # Times Square is around 40.758, -73.985
        assert 40.7 < data["latitude"] < 40.8, "Latitude should be in NYC range"
        assert -74.0 < data["longitude"] < -73.9, "Longitude should be in NYC range"
        
        print(f"✓ Geocoded Times Square: {data['latitude']}, {data['longitude']}")

    def test_geocode_invalid_location(self, api_client):
        """Test geocoding invalid location returns 404"""
        response = api_client.get(f"{BASE_URL}/api/geocode?q=InvalidLocationXYZ123")
        
        print(f"Geocode invalid location status: {response.status_code}")
        assert response.status_code == 404, "Should return 404 for invalid location"
        print("✓ Invalid location handled correctly")


class TestPlans:
    """Plans/Calendar API tests"""

    def test_create_plan_with_auto_analysis(self, api_client, auth_headers):
        """Test creating a plan with automatic safety analysis"""
        plan_data = {
            "title": "TEST_Visit Central Park",
            "location_name": "Central Park",
            "latitude": 40.785091,
            "longitude": -73.968285,
            "start_time": "2026-05-15T14:00:00",
            "end_time": "2026-05-15T16:00:00",
            "notes": "Afternoon walk"
        }
        
        response = api_client.post(f"{BASE_URL}/api/plans", json=plan_data, headers=auth_headers)
        
        print(f"Create plan status: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["title"] == plan_data["title"]
        assert data["location_name"] == plan_data["location_name"]
        assert data["latitude"] == plan_data["latitude"]
        assert data["longitude"] == plan_data["longitude"]
        assert "safety_analysis" in data
        
        # Verify safety analysis was auto-generated
        if data["safety_analysis"]:
            analysis = data["safety_analysis"]
            assert "rating" in analysis
            assert "risk_level" in analysis
            assert "assessment" in analysis
            print(f"✓ Plan created with safety analysis: {analysis['risk_level']} risk")
        else:
            print("✓ Plan created (safety analysis pending)")
        
        # Cleanup: delete the test plan
        plan_id = data["id"]
        api_client.delete(f"{BASE_URL}/api/plans/{plan_id}", headers=auth_headers)

    def test_get_plans(self, api_client, auth_headers):
        """Test getting user's plans"""
        response = api_client.get(f"{BASE_URL}/api/plans", headers=auth_headers)
        
        print(f"GET /plans status: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "plans" in data
        assert isinstance(data["plans"], list)
        print(f"✓ Retrieved {len(data['plans'])} plans")

    def test_delete_plan(self, api_client, auth_headers):
        """Test deleting a plan"""
        # Create a plan first
        plan_data = {
            "title": "TEST_Delete Me",
            "location_name": "Brooklyn Bridge",
            "start_time": "2026-06-01T10:00:00"
        }
        create_response = api_client.post(f"{BASE_URL}/api/plans", json=plan_data, headers=auth_headers)
        assert create_response.status_code == 200
        plan_id = create_response.json()["id"]
        
        # Delete it
        delete_response = api_client.delete(f"{BASE_URL}/api/plans/{plan_id}", headers=auth_headers)
        
        print(f"Delete plan status: {delete_response.status_code}")
        assert delete_response.status_code == 200
        
        # Verify it's gone
        get_response = api_client.get(f"{BASE_URL}/api/plans", headers=auth_headers)
        plans = get_response.json()["plans"]
        assert not any(p["id"] == plan_id for p in plans), "Plan should be deleted"
        print("✓ Plan deleted successfully")


class TestChat:
    """AI Chat API tests"""

    def test_send_chat_message(self, api_client, auth_headers):
        """Test sending a chat message and getting AI response"""
        message_data = {"message": "Is Times Square safe at night?"}
        
        response = api_client.post(f"{BASE_URL}/api/chat", json=message_data, headers=auth_headers)
        
        print(f"POST /chat status: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "response" in data
        assert isinstance(data["response"], str)
        assert len(data["response"]) > 10, "Response should be substantial"
        print(f"✓ Chat response received: {len(data['response'])} characters")

    def test_get_chat_history(self, api_client, auth_headers):
        """Test retrieving chat history"""
        response = api_client.get(f"{BASE_URL}/api/chat/history", headers=auth_headers)
        
        print(f"GET /chat/history status: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "messages" in data
        assert isinstance(data["messages"], list)
        print(f"✓ Retrieved {len(data['messages'])} chat messages")

    def test_clear_chat_history(self, api_client, auth_headers):
        """Test clearing chat history"""
        # Send a message first
        api_client.post(f"{BASE_URL}/api/chat", json={"message": "Test message"}, headers=auth_headers)
        time.sleep(1)
        
        # Clear history
        response = api_client.delete(f"{BASE_URL}/api/chat/history", headers=auth_headers)
        
        print(f"DELETE /chat/history status: {response.status_code}")
        assert response.status_code == 200
        
        # Verify it's cleared
        get_response = api_client.get(f"{BASE_URL}/api/chat/history", headers=auth_headers)
        messages = get_response.json()["messages"]
        assert len(messages) == 0, "Chat history should be empty"
        print("✓ Chat history cleared")
