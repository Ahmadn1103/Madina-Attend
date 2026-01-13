# Madina Attend Backend

FastAPI backend for the Madina Attend student attendance system.

## Setup

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up Google Sheets Service Account:**
   - Create a service account in Google Cloud Console
   - Download the JSON credentials file
   - Share your Google Spreadsheet with the service account email
   - Set up environment variables (see `.env.example`)

3. **Configure environment variables:**
   - Copy `.env.example` to `.env`
   - Fill in your Google credentials and spreadsheet ID
   - Either set `GOOGLE_CREDENTIALS` (JSON string) or `GOOGLE_CREDENTIALS_PATH` (file path)
   - Set `SPREADSHEET_ID` to your Google Spreadsheet ID

4. **Run the server:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

## Google Sheets Structure

### Students Sheet
- Column A: Student ID
- Column B: PIN
- Column C: Name

### Logs Sheet (auto-created if missing)
- Column A: Timestamp
- Column B: Student ID
- Column C: Student Name
- Column D: Action Type (Check In / Check Out)

## API Endpoints

- `GET /` - Health check
- `POST /checkin` - Process check-in/check-out request

### Check-in Request Format
```json
{
  "student_id": "string",
  "pin": "string",
  "action": "checkin" | "checkout"
}
```

### Response Format
```json
{
  "success": true,
  "message": "Successfully checked in.",
  "student_name": "Student Name"
}
```
