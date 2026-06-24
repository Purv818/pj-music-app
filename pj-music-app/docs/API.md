# PJ Music App — API Documentation

**Base URL:** `https://your-server.com/api`

All responses follow this shape:
```json
{ "success": true, "message": "...", "data": { ... } }
```

**Authentication:** Include `Authorization: Bearer <accessToken>` on all protected routes.

**Rate Limits:**
- General API: 100 requests / 15 min per IP
- Auth endpoints: 10 requests / 15 min per IP

---

## Auth

### POST /auth/register
Register a new account.

**Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "Secret123",
  "displayName": "John"
}
```

**Validation:**
- `username`: 3–30 chars, alphanumeric + underscores only
- `email`: valid email format
- `password`: min 8 chars, 1 uppercase, 1 number

**Response 201:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "_id": "...", "username": "john_doe", "email": "john@example.com", "displayName": "John" }
  }
}
```

**Errors:** `409 Conflict` (email or username taken), `422 Unprocessable Entity` (validation failed)

---

### POST /auth/login
Login with email and password.

**Body:**
```json
{ "email": "john@example.com", "password": "Secret123" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "_id": "...", "username": "john_doe", "displayName": "John" }
  }
}
```

**Errors:**
- `401 Unauthorized` — wrong credentials
- `423 Locked` — account locked after 5 failed attempts (30 min lockout)
- `403 Forbidden` — account deactivated

---

### POST /auth/refresh-token
Exchange a refresh token for a new access/refresh token pair.

**Body:**
```json
{ "refreshToken": "eyJ..." }
```

**Response 200:**
```json
{
  "success": true,
  "data": { "accessToken": "eyJ...", "refreshToken": "eyJ..." }
}
```

**Errors:** `401` — invalid, expired, or reused refresh token (token reuse triggers full revocation)

---

### POST /auth/logout *(protected)*
Revoke the current refresh token (logs out current device only).

**Body:**
```json
{ "refreshToken": "eyJ..." }
```

**Response 200:** `{ "success": true, "message": "Logged out successfully." }`

---

### POST /auth/forgot-password
Trigger a password reset email. Always returns 200 to prevent user enumeration.

**Body:**
```json
{ "email": "john@example.com" }
```

**Response 200:** `{ "success": true, "message": "If that email exists, a password reset link has been sent." }`

---

### PATCH /auth/reset-password/:token
Reset password using the token from the reset email.

**Params:** `:token` — raw token from email link

**Body:**
```json
{ "password": "NewPass123" }
```

**Response 200:** `{ "success": true, "message": "Password reset successful. Please log in." }`

**Errors:** `400` — token invalid or expired

---

### GET /auth/me *(protected)*
Returns the currently authenticated user.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "username": "john_doe",
    "email": "john@example.com",
    "displayName": "John",
    "bio": "",
    "avatar": null,
    "theme": "dark",
    "friends": [],
    "favorites": []
  }
}
```

---

## Users

### GET /users/search?q= *(protected)*
Search users by username or display name. Minimum 2 characters. Excludes self.

**Query:** `?q=john`

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "_id": "...", "username": "john_doe", "displayName": "John", "avatar": null, "lastSeen": "2026-06-23T..." }
  ]
}
```

**Errors:** `400` — query too short

---

### GET /users/:id *(protected)*
Get a user's public profile by ID.

**Response 200:**
```json
{
  "success": true,
  "data": { "_id": "...", "username": "john_doe", "displayName": "John", "bio": "...", "avatar": null, "lastSeen": "..." }
}
```

---

### PATCH /users/me *(protected)*
Update your own profile. Only allowed fields: `displayName`, `bio`, `avatar`, `theme`.

**Body (any subset):**
```json
{
  "displayName": "Johnny",
  "bio": "Music lover",
  "theme": "light"
}
```

**Response 200:** `{ "success": true, "data": { ...updatedUser } }`

---

### PATCH /users/me/password *(protected)*
Change your password. Revokes all existing refresh tokens (forces re-login on all devices).

**Body:**
```json
{ "currentPassword": "OldPass123", "newPassword": "NewPass456" }
```

**Response 200:** `{ "success": true, "message": "Password changed. Please log in again on all devices." }`

**Errors:** `401` — current password incorrect

---

### DELETE /users/me *(protected)*
Deactivate your account (soft delete — sets `isActive: false`).

**Response 200:** `{ "success": true, "message": "Account deactivated." }`

---

## Songs

### POST /songs/sync *(protected)*
Bulk upsert song metadata from a device scan. Max 5,000 songs per request.

**Body:**
```json
{
  "songs": [
    {
      "title": "Bohemian Rhapsody",
      "artist": "Queen",
      "album": "A Night at the Opera",
      "genre": "Rock",
      "duration": 354,
      "filePath": "content://media/external/audio/media/123",
      "fileSize": 8945678,
      "mimeType": "audio/mpeg",
      "trackNumber": 11,
      "year": 1975,
      "artwork": null
    }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": { "upserted": 3, "modified": 5 }
}
```

---

### GET /songs *(protected)*
List your songs with sorting and pagination.

**Query params:**
- `sortBy`: `title` | `artist` | `album` | `playCount` | `createdAt` | `lastPlayed` (default: `title`)
- `order`: `asc` | `desc` (default: `asc`)
- `page`: page number (default: 1)
- `limit`: results per page, max 500 (default: 100)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "songs": [ { "_id": "...", "title": "...", "artist": "...", "album": "...", "duration": 245 } ],
    "total": 150,
    "page": 1,
    "pages": 2
  }
}
```

---

### GET /songs/search?q= *(protected)*
Full-text search across title, artist, album, and genre. Returns up to 100 results.

**Query:** `?q=queen`

**Response 200:**
```json
{
  "success": true,
  "data": [ { "_id": "...", "title": "Bohemian Rhapsody", "artist": "Queen", ... } ]
}
```

---

### GET /songs/favorites *(protected)*
Get all songs the user has favorited.

**Response 200:**
```json
{ "success": true, "data": [ { "_id": "...", "title": "...", ... } ] }
```

---

### POST /songs/:id/play *(protected)*
Record a play event — increments `playCount` and updates `lastPlayed`.

**Response 200:**
```json
{ "success": true, "data": { "playCount": 42 } }
```

---

### POST /songs/:id/favorite *(protected)*
Toggle a song's favorite status.

**Response 200:**
```json
{ "success": true, "data": { "isFavorite": true } }
```

---

### DELETE /songs/:id *(protected)*
Soft-delete a song (sets `isDeleted: true`). Song is excluded from all future queries.

**Response 200:** `{ "success": true, "message": "Song removed." }`

---

## Playlists

### POST /playlists *(protected)*
Create a new playlist.

**Body:**
```json
{ "name": "Road Trip Mix", "description": "Songs for long drives", "isPublic": false }
```

**Response 201:**
```json
{ "success": true, "data": { "_id": "...", "name": "Road Trip Mix", "songs": [] } }
```

---

### GET /playlists *(protected)*
Get all playlists owned by the current user.

**Response 200:**
```json
{
  "success": true,
  "data": [ { "_id": "...", "name": "Road Trip Mix", "songCount": 12, "isPublic": false } ]
}
```

---

### GET /playlists/:id *(protected)*
Get a single playlist with all songs. Private playlists are only accessible by owner.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "Road Trip Mix",
    "songs": [ { "song": { "_id": "...", "title": "..." }, "addedAt": "..." } ]
  }
}
```

**Errors:** `403` — private playlist, not owner | `404` — not found

---

### PATCH /playlists/:id *(protected)*
Update playlist metadata (name, description, artwork, isPublic). Owner only.

**Body (any subset):**
```json
{ "name": "New Name", "isPublic": true }
```

---

### DELETE /playlists/:id *(protected)*
Soft-delete a playlist. Owner only.

---

### POST /playlists/:id/songs *(protected)*
Add a song to a playlist. Song must belong to the current user.

**Body:**
```json
{ "songId": "64abc..." }
```

**Response 200:**
```json
{ "success": true, "data": { "songCount": 13 } }
```

**Errors:** `409` — song already in playlist

---

### DELETE /playlists/:id/songs/:songId *(protected)*
Remove a song from a playlist. Owner only.

---

### PATCH /playlists/:id/songs/reorder *(protected)*
Reorder songs in a playlist. Owner only.

**Body:**
```json
{ "orderedSongIds": ["64abc...", "64def...", "64ghi..."] }
```

---

## Friends

### POST /friends/request/:id *(protected)*
Send a friend request to another user.

If the target user already sent you a request, it auto-accepts and both become friends.

**Response 200:** `{ "success": true, "message": "Friend request sent." }`

**Errors:**
- `400` — trying to friend yourself
- `409` — already friends or request already sent
- `404` — user not found

---

### GET /friends *(protected)*
Get your confirmed friends list.

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "_id": "...", "username": "jane_doe", "displayName": "Jane", "avatar": null, "lastSeen": "..." }
  ]
}
```

---

### GET /friends/requests *(protected)*
Get pending friend requests (received and sent).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "received": [ { "_id": "...", "username": "alice", "displayName": "Alice" } ],
    "sent": [ { "_id": "...", "username": "bob", "displayName": "Bob" } ]
  }
}
```

---

### POST /friends/accept/:id *(protected)*
Accept a received friend request.

**Response 200:** `{ "success": true, "message": "Friend request accepted." }`

---

### POST /friends/reject/:id *(protected)*
Reject a received friend request.

**Response 200:** `{ "success": true, "message": "Friend request rejected." }`

---

### DELETE /friends/:id *(protected)*
Remove someone from your friends list (mutual removal).

**Response 200:** `{ "success": true, "message": "Friend removed." }`

---

## Rooms

### POST /rooms *(protected)*
Create a new listening room.

**Body:**
```json
{ "name": "Friday Night Jams", "isPrivate": true, "maxMembers": 10 }
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "name": "Friday Night Jams",
    "owner": "...",
    "members": [ { "user": "...", "joinedAt": "..." } ],
    "status": "active",
    "maxMembers": 10
  }
}
```

---

### GET /rooms *(protected)*
Get all active rooms the user owns or is a member of.

**Response 200:**
```json
{
  "success": true,
  "data": [ { "_id": "...", "name": "...", "owner": {...}, "members": [...], "status": "active" } ]
}
```

---

### GET /rooms/:id *(protected)*
Get a room's full detail including current playback state.

**Errors:** `403` — private room, not a member | `404` — not found or ended

---

### POST /rooms/:id/invite *(protected)*
Invite a friend to the room. Owner only. Generates a 24-hour secure token and sends a real-time notification via Socket.IO.

**Body:**
```json
{ "inviteeId": "64abc..." }
```

**Response 200:**
```json
{ "success": true, "data": { "invitationToken": "a3f4..." } }
```

**Errors:** `404` — room or user not found | `409` — already a member | `400` — room full | `403` — not owner

---

### POST /rooms/join *(protected)*
Join a room using an invitation token.

**Body:**
```json
{ "token": "a3f4..." }
```

**Response 200:**
```json
{ "success": true, "data": { "roomId": "64abc..." } }
```

**Errors:** `400` — invalid/expired token | `403` — invitation not for this user | `400` — room full

---

### POST /rooms/:id/leave *(protected)*
Leave a room. If the owner leaves, the room ends and all members are notified.

---

### PATCH /rooms/:id/playback *(protected)*
Update the room's playback state. Owner only. Broadcasts `room:playbackSync` to all members via Socket.IO.

**Body (any subset):**
```json
{
  "currentSong": "64abc...",
  "songTitle": "Bohemian Rhapsody",
  "songArtist": "Queen",
  "isPlaying": true,
  "position": 45.2,
  "queue": ["64def...", "64ghi..."]
}
```

---

## Real-Time Events (Socket.IO)

**Connection:** Connect to `SOCKET_URL` with `{ auth: { token: "<accessToken>" } }`.

### Room Events

| Event (client → server) | Payload | Description |
|---|---|---|
| `room:join` | `{ roomId }` | Join a room channel and receive current playback state |
| `room:leave` | `{ roomId }` | Leave a room channel |
| `room:play` | `{ roomId }` | Owner: resume playback |
| `room:pause` | `{ roomId }` | Owner: pause playback |
| `room:seek` | `{ roomId, position }` | Owner: seek to position (seconds) |
| `room:next` | `{ roomId }` | Owner: skip to next track |
| `room:changeSong` | `{ roomId, songId, songTitle, songArtist, position }` | Owner: change current song |

| Event (server → client) | Payload | Description |
|---|---|---|
| `room:sync` | `playbackState` | Sent to a new joiner with current playback state |
| `room:playbackSync` | `playbackState` | Broadcast to all room members when playback changes |
| `room:memberJoined` | `{ userId, username, displayName }` | Someone joined the room |
| `room:memberLeft` | `{ userId, username }` | Someone left the room |
| `room:ended` | `{ reason }` | Room was ended (owner left) |
| `room:invitation` | `{ roomId, roomName, invitedBy, token, expiresAt }` | Received in user's personal room |

### Peer Sync Events

| Event (client → server) | Payload | Description |
|---|---|---|
| `sync:invite` | `{ targetUserId }` | Send a listen-together invite |
| `sync:accept` | `{ inviterId }` | Accept an invite; creates a sync session |
| `sync:decline` | `{ inviterId }` | Decline an invite |
| `sync:joinSession` | `{ sessionId }` | Inviter joins the session room |
| `sync:update` | `{ sessionId, state }` | Push playback state to peer |
| `sync:end` | `{ sessionId }` | End a sync session |

| Event (server → client) | Payload | Description |
|---|---|---|
| `sync:inviteReceived` | `{ from: { id, username, displayName, avatar } }` | Incoming listen invite |
| `sync:accepted` | `{ by: { id, username }, sessionId }` | Your invite was accepted |
| `sync:declined` | `{ by: { id, username } }` | Your invite was declined |
| `sync:stateSync` | `playbackState` | Peer's playback state update |
| `sync:ended` | `{ by: { id, username } }` | Peer ended the session |
| `sync:peerDisconnected` | `{ userId, username }` | Peer disconnected |

### Playback State Object

```json
{
  "currentSong": "64abc...",
  "songTitle": "Bohemian Rhapsody",
  "songArtist": "Queen",
  "isPlaying": true,
  "position": 45.2,
  "updatedAt": "2026-06-23T10:00:00.000Z",
  "queue": ["64def...", "64ghi..."]
}
```

---

## Error Codes

| HTTP Code | Meaning |
|---|---|
| `400` | Bad Request — missing or invalid input |
| `401` | Unauthorized — missing, invalid, or expired token |
| `403` | Forbidden — authenticated but not allowed |
| `404` | Not Found |
| `409` | Conflict — duplicate resource |
| `422` | Unprocessable Entity — validation failed (`errors` array included) |
| `423` | Locked — account temporarily locked |
| `429` | Too Many Requests — rate limit exceeded |
| `500` | Internal Server Error |

---

## Pagination

Paginated endpoints return:
```json
{
  "data": { "songs": [...], "total": 150, "page": 1, "pages": 2 }
}
```

Use `?page=2&limit=50` to paginate.
