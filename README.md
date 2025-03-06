# techfest2025

## Overview
This project is a Chrome Extension designed to detect AI-generated content in YouTube Shorts. It operates in real-time
while a user is watching Shorts, analyzing metadata and flagging AI-generated videos.
### Key Features:
- Detects when a YouTube Short is being played.
- Extracts video metadata (title, channel name, and description).
- Uses YouTube Data API to fetch the full description.
- Analyzes content using Azure OpenAI (GPT-4) to determine AI-generated content.
- Flags AI-generated content by overlaying a warning.
