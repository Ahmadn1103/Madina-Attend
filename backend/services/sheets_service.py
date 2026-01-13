"""
Google Sheets service for student validation and attendance logging
"""
import os
import json
from datetime import datetime
import gspread
from google.oauth2.service_account import Credentials


class SheetsService:
    """Service for interacting with Google Sheets"""
    
    def __init__(self):
        """Initialize Google Sheets client with service account credentials"""
        # Get credentials from environment variable
        # Can be either JSON string or path to JSON file
        credentials_json = os.getenv("GOOGLE_CREDENTIALS")
        credentials_path = os.getenv("GOOGLE_CREDENTIALS_PATH")
        
        if credentials_json:
            # Parse JSON string from environment variable
            creds_info = json.loads(credentials_json)
            credentials = Credentials.from_service_account_info(
                creds_info,
                scopes=[
                    "https://www.googleapis.com/auth/spreadsheets",
                    "https://www.googleapis.com/auth/drive",
                ],
            )
        elif credentials_path:
            # Load from file path
            credentials = Credentials.from_service_account_file(
                credentials_path,
                scopes=[
                    "https://www.googleapis.com/auth/spreadsheets",
                    "https://www.googleapis.com/auth/drive",
                ],
            )
        else:
            raise ValueError(
                "Either GOOGLE_CREDENTIALS or GOOGLE_CREDENTIALS_PATH must be set"
            )
        
        self.client = gspread.authorize(credentials)
        
        # Get spreadsheet ID from environment
        spreadsheet_id = os.getenv("SPREADSHEET_ID")
        if not spreadsheet_id:
            raise ValueError("SPREADSHEET_ID environment variable must be set")
        
        self.spreadsheet = self.client.open_by_key(spreadsheet_id)
    
    def log_attendance(self, name: str, action: str) -> None:
        """
        Log attendance action to the Logs sheet
        
        Args:
            name: The student's name
            action: The action type ("checkin" or "checkout")
        """
        try:
            # Open the Logs sheet (create if it doesn't exist)
            try:
                logs_sheet = self.spreadsheet.worksheet("Logs")
                # Check if headers exist, if not add them
                headers = logs_sheet.row_values(1)
                if not headers or headers[0] != "Timestamp":
                    logs_sheet.clear()
                    logs_sheet.append_row(["Timestamp", "Name", "Action Type"])
            except gspread.exceptions.WorksheetNotFound:
                # Create the Logs sheet if it doesn't exist
                logs_sheet = self.spreadsheet.add_worksheet(
                    title="Logs", rows=1000, cols=3
                )
                # Add header row
                logs_sheet.append_row(["Timestamp", "Name", "Action Type"])
            
            # Format action text
            action_text = "Check In" if action == "checkin" else "Check Out"
            
            # Get current timestamp
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            
            # Append the log entry
            logs_sheet.append_row([
                timestamp,
                name.strip(),
                action_text,
            ])
            
        except Exception as e:
            raise Exception(f"Error logging attendance: {str(e)}")
