"""
Tests for new features: Community Reports, Notifications, Subscription, Calendar, Analysis Limits
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://nyc-guard-ai.preview.emergentagent.com').rstrip('/')

class TestCommunityReports:
    """Community reporting feature tests"""

    def test_create_report_success(self, api_client, admin_token):
        """Test creating a community report"""
        response = api_client.post(
            f"{BASE_URL}/api/reports",
            json={
                "title": "TEST_Suspicious activity near park",
                "description": "Saw suspicious individuals loitering",
                "category": "suspicious_activity",
                "latitude": 40.7829,
                "longitude": -73.9654,
                "location_name": "Central Park North"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "TEST_Suspicious activity near park"
        assert data["category"] == "suspicious_activity"
        assert data["upvotes"] == 0
        assert data["downvotes"] == 0
        assert "id" in data
        return data["id"]

    def test_get_reports_list(self, api_client, admin_token):
        """Test getting list of reports"""
        response = api_client.get(
            f"{BASE_URL}/api/reports",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "reports" in data
        assert "categories" in data
        assert isinstance(data["reports"], list)
        assert len(data["categories"]) == 8  # 8 categories defined

    def test_get_reports_filtered_by_category(self, api_client, admin_token):
        """Test filtering reports by category"""
        response = api_client.get(
            f"{BASE_URL}/api/reports?category=shooting",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "reports" in data
        # All reports should be shooting category if any exist
        for report in data["reports"]:
            assert report["category"] == "shooting"

    def test_vote_on_report_upvote(self, api_client, admin_token):
        """Test upvoting a report"""
        # First create a report
        create_response = api_client.post(
            f"{BASE_URL}/api/reports",
            json={
                "title": "TEST_Vote test report",
                "description": "Testing voting",
                "category": "other",
                "latitude": 40.7128,
                "longitude": -74.0060,
                "location_name": "Downtown"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        report_id = create_response.json()["id"]

        # Now vote on it
        vote_response = api_client.post(
            f"{BASE_URL}/api/reports/{report_id}/vote",
            json={"vote": 1},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert vote_response.status_code == 200
        vote_data = vote_response.json()
        assert vote_data["upvotes"] == 1
        assert vote_data["downvotes"] == 0

    def test_vote_on_report_downvote(self, api_client, admin_token):
        """Test downvoting a report"""
        # Create a report
        create_response = api_client.post(
            f"{BASE_URL}/api/reports",
            json={
                "title": "TEST_Downvote test",
                "description": "Testing downvote",
                "category": "other",
                "latitude": 40.7128,
                "longitude": -74.0060,
                "location_name": "Test Location"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        report_id = create_response.json()["id"]

        # Downvote
        vote_response = api_client.post(
            f"{BASE_URL}/api/reports/{report_id}/vote",
            json={"vote": -1},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert vote_response.status_code == 200
        vote_data = vote_response.json()
        assert vote_data["upvotes"] == 0
        assert vote_data["downvotes"] == 1

    def test_vote_invalid_value(self, api_client, admin_token):
        """Test voting with invalid value"""
        # Create a report first
        create_response = api_client.post(
            f"{BASE_URL}/api/reports",
            json={
                "title": "TEST_Invalid vote test",
                "description": "Testing",
                "category": "other",
                "latitude": 40.7128,
                "longitude": -74.0060,
                "location_name": "Test"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        report_id = create_response.json()["id"]

        # Try invalid vote
        vote_response = api_client.post(
            f"{BASE_URL}/api/reports/{report_id}/vote",
            json={"vote": 5},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert vote_response.status_code == 400

    def test_create_report_invalid_category(self, api_client, admin_token):
        """Test creating report with invalid category"""
        response = api_client.post(
            f"{BASE_URL}/api/reports",
            json={
                "title": "TEST_Invalid category",
                "description": "Test",
                "category": "invalid_category",
                "latitude": 40.7128,
                "longitude": -74.0060,
                "location_name": "Test"
            },
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400


class TestAnalysisLimits:
    """Analysis limit tracking tests"""

    def test_get_analysis_limit_premium_user(self, api_client, admin_token):
        """Test analysis limit for premium user (admin is premium)"""
        response = api_client.get(
            f"{BASE_URL}/api/safety/limit",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tier"] == "premium"
        assert data["limit"] == -1  # Unlimited
        assert data["remaining"] == -1

    def test_get_analysis_limit_free_user(self, api_client):
        """Test analysis limit for free user"""
        # Register a new free user with unique email
        import time
        unique_email = f"test_free_limit_{int(time.time())}@example.com"
        register_response = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": "TEST_Free User",
                "email": unique_email,
                "password": "testpass123"
            }
        )
        token = register_response.json()["access_token"]

        # Check limit
        response = api_client.get(
            f"{BASE_URL}/api/safety/limit",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["tier"] == "free"
        assert data["limit"] == 5
        assert data["used"] == 0
        assert data["remaining"] == 5


class TestNotifications:
    """Notification system tests"""

    def test_get_notifications_empty(self, api_client, admin_token):
        """Test getting notifications when none exist"""
        response = api_client.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "notifications" in data
        assert isinstance(data["notifications"], list)

    def test_mark_notifications_read(self, api_client, admin_token):
        """Test marking notifications as read"""
        response = api_client.post(
            f"{BASE_URL}/api/notifications/mark-read",
            json={},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    def test_register_push_token(self, api_client, admin_token):
        """Test registering push notification token"""
        response = api_client.post(
            f"{BASE_URL}/api/notifications/register-token",
            json={"token": "ExponentPushToken[test123]"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data


class TestGoogleCalendar:
    """Google Calendar integration tests"""

    def test_calendar_status_not_configured(self, api_client, admin_token):
        """Test calendar status when Google credentials not configured"""
        response = api_client.get(
            f"{BASE_URL}/api/calendar/status",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "configured" in data
        assert "connected" in data
        assert data["configured"] == False  # No GOOGLE_CLIENT_ID/SECRET in .env
        assert data["connected"] == False

    def test_calendar_auth_url_not_configured(self, api_client, admin_token):
        """Test getting auth URL when not configured"""
        response = api_client.get(
            f"{BASE_URL}/api/calendar/auth-url",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400  # Should fail when not configured
        data = response.json()
        assert "detail" in data


class TestStripeSubscription:
    """Stripe subscription tests"""

    def test_create_checkout_session(self, api_client):
        """Test creating Stripe checkout session"""
        # Register a free user with unique email
        import time
        unique_email = f"test_stripe_{int(time.time())}@example.com"
        register_response = api_client.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": "TEST_Stripe User",
                "email": unique_email,
                "password": "testpass123"
            }
        )
        token = register_response.json()["access_token"]

        # Create checkout session
        response = api_client.post(
            f"{BASE_URL}/api/subscription/checkout",
            json={"origin_url": "https://nyc-guard-ai.preview.emergentagent.com"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "session_id" in data
        assert "stripe" in data["url"].lower() or "checkout" in data["url"].lower()

    def test_checkout_already_premium(self, api_client, admin_token):
        """Test checkout when already premium"""
        response = api_client.post(
            f"{BASE_URL}/api/subscription/checkout",
            json={"origin_url": "https://nyc-guard-ai.preview.emergentagent.com"},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 400  # Admin is already premium
        data = response.json()
        assert "detail" in data


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def admin_token(api_client):
    """Get admin access token"""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "admin@example.com", "password": "admin123"}
    )
    return response.json()["access_token"]
