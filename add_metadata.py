#!/usr/bin/env python3
"""Add ID3 metadata to sample audio files"""

from mutagen.id3 import ID3, TIT2, TPE1, TALB, ID3NoHeaderError
import os

# Metadata for each file: (filename, title, artist, album)
metadata = [
    # Root folder
    ("sample-audio/01-welcome.mp3", "Welcome", "DJ Rockstar", "Radio Essentials"),
    ("sample-audio/02-station-id.mp3", "Station ID", "WXYZ Radio", "Radio Essentials"),
    ("sample-audio/03-weather.mp3", "Weather Update", "News Team", "Radio Essentials"),
    ("sample-audio/04-news-intro.mp3", "News Intro", "News Team", "Radio Essentials"),
    ("sample-audio/05-commercial-break.mp3", "Commercial Break", "Ad Department", "Radio Essentials"),
    
    # Subfolder
    ("sample-audio/subfolder/06-time-check.mp3", "Time Check", "DJ Rockstar", "Radio Jingles"),
    ("sample-audio/subfolder/07-traffic.mp3", "Traffic Report", "Traffic Watch", "Radio Jingles"),
    ("sample-audio/subfolder/08-jinglereallylongnamereallylongnamereallylongname.mp3", "Super Long Jingle Name For Testing", "The Extended Artists Collective", "The Album With A Really Long Name"),
    ("sample-audio/subfolder/09-outro.mp3", "Outro", "DJ Rockstar", "Radio Jingles"),
    ("sample-audio/subfolder/10-test-tone.mp3", "Test Tone", "Engineering", "Radio Jingles"),
]

base_path = os.path.dirname(os.path.abspath(__file__))

for filepath, title, artist, album in metadata:
    full_path = os.path.join(base_path, filepath)
    
    if not os.path.exists(full_path):
        print(f"File not found: {full_path}")
        continue
    
    try:
        # Try to load existing ID3 tags
        try:
            tags = ID3(full_path)
        except ID3NoHeaderError:
            # Create new ID3 header
            tags = ID3()
        
        # Set metadata
        tags['TIT2'] = TIT2(encoding=3, text=title)  # Title
        tags['TPE1'] = TPE1(encoding=3, text=artist)  # Artist
        tags['TALB'] = TALB(encoding=3, text=album)  # Album
        
        # Save tags
        tags.save(full_path)
        print(f"✓ {filepath}: {title} - {artist} ({album})")
        
    except Exception as e:
        print(f"✗ Error with {filepath}: {e}")

print("\nDone!")
