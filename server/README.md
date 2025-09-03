# Server

Backend Django REST API.

## Auth & RBAC

This server supports multi-tenant organizations. Use these endpoints:

- POST /api/auth/register/ to create an organization and admin user
	- body: { "org_name": "Acme", "admin_username": "alice", "admin_password": "********", "admin_email": "a@acme.com" }
	- returns: token and organization info

- POST /api/auth/login/ to login an existing user
	- body: { "username": "alice", "password": "********" }
	- returns: token and organization context

Send `Authorization: Token <token>` to access protected endpoints like `POST /api/sync/`.

