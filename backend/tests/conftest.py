import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('BACKEND_URL') or 'https://nyc-guard-ai.preview.emergentagent.com'
BASE_URL = BASE_URL.rstrip('/')

@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture
def admin_token(api_client):
    """Get admin auth token"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@example.com",
        "password": "admin123"
    })
    if response.status_code != 200:
        pytest.skip("Admin login failed - cannot run authenticated tests")
    return response.json()["access_token"]

@pytest.fixture
def test_user_token(api_client):
    """Get or create test user token"""
    # Try login first
    response = api_client.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@example.com",
        "password": "test123"
    })
    if response.status_code == 200:
        return response.json()["access_token"]
    
    # Register if doesn't exist
    response = api_client.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Test User",
        "email": "test@example.com",
        "password": "test123"
    })
    if response.status_code in [200, 201]:
        return response.json()["access_token"]
    
    pytest.skip("Could not create test user")

@pytest.fixture
def auth_headers(test_user_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {test_user_token}"}
