# Chamapay Miniapp API Endpoints

This document outlines the API endpoints available for the Chamapay miniapp. All endpoints under `/miniapp` require a Bearer token in the `Authorization` header.

## Authentication & User

### GET `/user/address/:address`
- **Description**: Fetch user details by wallet address.
- **Response**: `User` object or 404.

### GET `/user/notifications/:userId`
- **Description**: Fetch notifications for a specific user.
- **Response**: Array of `Notification` objects.

### GET `/miniapp/user-details`
- **Headers**: `Authorization: Bearer <token>`
- **Description**: Fetch comprehensive details for the logged-in user, including recent notifications and pending requests they need to handle.
- **Response**: `{ success: true, user: { ... } }`

## Chama Management

### GET `/chama/slug/:slug`
- **Query Params**: `address` (optional)
- **Description**: Fetch chama details by slug. If `address` is provided, returns membership status.
- **Response**: `{ success: true, chama: { ... }, isMember: boolean, adminWallet: string }`

### GET `/chama/pending-requests/:userId`
- **Description**: Fetch pending join requests for chamas managed by the user.
- **Response**: Array of `JoinRequest` objects.

### GET `/chama/check-request/:address/:chamaId`
- **Description**: Check if a specific address has a pending join request for a chama.
- **Response**: `boolean` (true/false).

### POST `/miniapp/create-chama`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: `{ name, description, type, adminTerms, amount, cycleTime, maxNo, startDate, blockchainId }`
- **Description**: Create a new chama (Prisma-side).

### POST `/miniapp/join-chama`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: `{ chamaId, amount, txHash }`
- **Description**: Join a public chama after completing the on-chain transaction.

## Join Requests

### POST `/miniapp/send-request`
- **Headers**: `Authorization: Bearer <token>`
- **Query Params**: `chamaId`
- **Body**: `{ address }`
- **Description**: Send a join request for a private chama.

### POST `/miniapp/confirm-request`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: `{ requestId, decision: 'approve' | 'reject' }`
- **Description**: Approve or reject a join request.

## Payments

### POST `/miniapp/register-payment`
- **Headers**: `Authorization: Bearer <token>`
- **Body**: `{ receiver, amount, description, txHash }`
- **Description**: Record a blockchain transaction in the database.
