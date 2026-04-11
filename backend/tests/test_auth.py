# Auth endpoint tests
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or os.environ.get('BACKEND_URL') or 'https://app-launch-241.preview.emergentagent.com'
BASE_URL = BASE_URL.rstrip('/')

class TestAuth:
    """Authentication endpoint tests"""

    def test_register_new_user(self, api_client):
        """Test user registration with unique email"""
        import uuid
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "New Test User",
            "email": unique_email,
            "password": "testpass123"
        })
        
        print(f"Register response status: {response.status_code}")
        assert response.status_code in [200, 201], f"Registration failed: {response.text}"
        
        data = response.json()
        assert "user" in data, "Response missing 'user' field"
        assert "access_token" in data, "Response missing 'access_token'"
        assert "refresh_token" in data, "Response missing 'refresh_token'"
        assert data["user"]["email"] == unique_email.lower()
        assert data["user"]["name"] == "New Test User"
        assert data["user"]["role"] == "user"
        print("✓ Registration successful")

    def test_register_duplicate_email(self, api_client):
        """Test registration with existing email fails"""
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Admin Duplicate",
            "email": "admin@example.com",
            "password": "anypass"
        })
        
        print(f"Duplicate register status: {response.status_code}")
        assert response.status_code == 400, "Should reject duplicate email"
        data = response.json()
        assert "already registered" in data["detail"].lower()
        print("✓ Duplicate email rejected")

    def test_login_admin_success(self, api_client):
        """Test admin login with correct credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@example.com",
            "password": "admin123"
        })
        
        print(f"Admin login status: {response.status_code}")
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        
        data = response.json()
        assert "user" in data
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "admin@example.com"
        assert data["user"]["role"] == "admin"
        assert len(data["access_token"]) > 20, "Token too short"
        print("✓ Admin login successful")

    def test_login_wrong_password(self, api_client):
        """Test login with wrong password fails"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@example.com",
            "password": "wrongpassword"
        })
        
        print(f"Wrong password status: {response.status_code}")
        assert response.status_code == 401, "Should reject wrong password"
        data = response.json()
        assert "invalid" in data["detail"].lower()
        print("✓ Wrong password rejected")

    def test_login_nonexistent_user(self, api_client):
        """Test login with non-existent email fails"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "anypass"
        })
        
        print(f"Nonexistent user status: {response.status_code}")
        assert response.status_code == 401
        print("✓ Nonexistent user rejected")

    def test_get_me_authenticated(self, api_client, test_user_token):
        """Test /auth/me returns user data when authenticated"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = api_client.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        print(f"GET /auth/me status: {response.status_code}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == "test@example.com"
        assert "password" not in data["user"], "Password should not be in response"
        assert "password_hash" not in data["user"], "Password hash should not be in response"
        print("✓ GET /auth/me successful")

    def test_get_me_unauthenticated(self, api_client):
        """Test /auth/me fails without token"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        
        print(f"Unauthenticated /auth/me status: {response.status_code}")
        assert response.status_code == 401
        print("✓ Unauthenticated request rejected")

    def test_logout(self, api_client, test_user_token):
        """Test logout endpoint"""
        headers = {"Authorization": f"Bearer {test_user_token}"}
        response = api_client.post(f"{BASE_URL}/api/auth/logout", json={}, headers=headers)
        
        print(f"Logout status: {response.status_code}")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ Logout successful")
