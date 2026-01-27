#!/usr/bin/env python3
"""Add comprehensive ID3 metadata to sample audio files"""

from mutagen.id3 import (
    ID3, ID3NoHeaderError,
    TIT2,  # Title
    TPE1,  # Artist
    TPE2,  # Album Artist
    TALB,  # Album
    TCON,  # Genre
    TRCK,  # Track number
    TPOS,  # Disc number
    TDRC,  # Recording date
    TCOM,  # Composer
    TPUB,  # Publisher
    TCOP,  # Copyright
    TBPM,  # BPM
    TKEY,  # Key
    COMM,  # Comments
    TSRC,  # ISRC
    TENC,  # Encoder
)
import os

# Comprehensive metadata for each file
metadata = [
    # Root folder files
    {
        "file": "sample-audio/01-welcome.mp3",
        "title": "Welcome",
        "artist": "DJ Rockstar",
        "album": "Radio Essentials",
        "albumArtist": "Various Artists",
        "genre": "Jingle",
        "track": "1/10",
        "disc": "1/1",
        "year": "2024",
        "composer": "Mike Stevens",
        "publisher": "Rockstar Media Inc.",
        "copyright": "© 2024 Rockstar Media",
        "bpm": "120",
        "key": "C",
        "comments": "Opening jingle, Upbeat, Energetic, Morning show, Radio intro",
        "isrc": "USRC12400001",
        "encoder": "Rockstar Audio Suite v1.3"
    },
    {
        "file": "sample-audio/02-station-id.mp3",
        "title": "Station ID",
        "artist": "WXYZ Radio",
        "album": "Radio Essentials",
        "albumArtist": "Various Artists",
        "genre": "Station ID",
        "track": "2/10",
        "disc": "1/1",
        "year": "2024",
        "composer": "Sarah Johnson",
        "publisher": "Rockstar Media Inc.",
        "copyright": "© 2024 WXYZ Broadcasting",
        "bpm": "100",
        "key": "G",
        "comments": "Legal ID, FCC compliance, Top of hour, Station branding",
        "isrc": "USRC12400002",
        "encoder": "Rockstar Audio Suite v1.3"
    },
    {
        "file": "sample-audio/03-weather.mp3",
        "title": "Weather Update",
        "artist": "News Team",
        "album": "Radio Essentials",
        "albumArtist": "Various Artists",
        "genre": "News",
        "track": "3/10",
        "disc": "1/1",
        "year": "2024",
        "composer": "David Chen",
        "publisher": "Rockstar Media Inc.",
        "copyright": "© 2024 Rockstar Media",
        "bpm": "85",
        "key": "Am",
        "comments": "Weather bed, Forecast, Meteorology, Soft background, Informational",
        "isrc": "USRC12400003",
        "encoder": "Rockstar Audio Suite v1.3"
    },
    {
        "file": "sample-audio/04-news-intro.mp3",
        "title": "News Intro",
        "artist": "News Team",
        "album": "Radio Essentials",
        "albumArtist": "Various Artists",
        "genre": "News",
        "track": "4/10",
        "disc": "1/1",
        "year": "2024",
        "composer": "David Chen",
        "publisher": "Rockstar Media Inc.",
        "copyright": "© 2024 Rockstar Media",
        "bpm": "110",
        "key": "D",
        "comments": "Breaking news, Headlines, Urgent, Dramatic, News bulletin",
        "isrc": "USRC12400004",
        "encoder": "Rockstar Audio Suite v1.3"
    },
    {
        "file": "sample-audio/05-commercial-break.mp3",
        "title": "Commercial Break",
        "artist": "Ad Department",
        "album": "Radio Essentials",
        "albumArtist": "Various Artists",
        "genre": "Transition",
        "track": "5/10",
        "disc": "1/1",
        "year": "2024",
        "composer": "Lisa Martinez",
        "publisher": "Rockstar Media Inc.",
        "copyright": "© 2024 Rockstar Media",
        "bpm": "95",
        "key": "F",
        "comments": "Ad break, Sponsor transition, Commercial intro, Advertising",
        "isrc": "USRC12400005",
        "encoder": "Rockstar Audio Suite v1.3"
    },
    
    # Subfolder files
    {
        "file": "sample-audio/subfolder/06-time-check.mp3",
        "title": "Time Check",
        "artist": "DJ Rockstar",
        "album": "Radio Jingles",
        "albumArtist": "DJ Rockstar",
        "genre": "Jingle",
        "track": "6/10",
        "disc": "1/1",
        "year": "2025",
        "composer": "Mike Stevens",
        "publisher": "Jingle Factory LLC",
        "copyright": "© 2025 Jingle Factory",
        "bpm": "128",
        "key": "Bb",
        "comments": "Time announcement, Clock, Hour check, Quick hit, Punctual",
        "isrc": "USRC12500006",
        "encoder": "Rockstar Audio Suite v1.3"
    },
    {
        "file": "sample-audio/subfolder/07-traffic.mp3",
        "title": "Traffic Report",
        "artist": "Traffic Watch",
        "album": "Radio Jingles",
        "albumArtist": "News Department",
        "genre": "News",
        "track": "7/10",
        "disc": "1/1",
        "year": "2025",
        "composer": "Jennifer Wu",
        "publisher": "Jingle Factory LLC",
        "copyright": "© 2025 Traffic Watch Network",
        "bpm": "90",
        "key": "E",
        "comments": "Commute update, Road conditions, Highway, Drive time, Rush hour",
        "isrc": "USRC12500007",
        "encoder": "Rockstar Audio Suite v1.3"
    },
    {
        "file": "sample-audio/subfolder/08-jinglereallylongnamereallylongnamereallylongname.mp3",
        "title": "Super Long Jingle Name For Testing UI Elements",
        "artist": "The Extended Artists Collective International",
        "album": "The Album With A Really Long Name For Testing",
        "albumArtist": "Various International Artists Collective",
        "genre": "Electronic/Dance/Pop Fusion",
        "track": "8/10",
        "disc": "1/1",
        "year": "2025",
        "composer": "Alexander Christopher Wellington III",
        "publisher": "International Broadcasting Consortium Ltd.",
        "copyright": "© 2025 Extended Rights Management Corporation",
        "bpm": "140",
        "key": "Ab",
        "comments": "UI Testing, Long text overflow, Scrolling test, Truncation check, Display validation, Layout stress test",
        "isrc": "USRC12500008",
        "encoder": "Rockstar Audio Suite v1.3"
    },
    {
        "file": "sample-audio/subfolder/09-outro.mp3",
        "title": "Outro",
        "artist": "DJ Rockstar",
        "album": "Radio Jingles",
        "albumArtist": "DJ Rockstar",
        "genre": "Jingle",
        "track": "9/10",
        "disc": "1/1",
        "year": "2025",
        "composer": "Mike Stevens",
        "publisher": "Jingle Factory LLC",
        "copyright": "© 2025 Jingle Factory",
        "bpm": "115",
        "key": "C#m",
        "comments": "Show ending, Sign off, Goodbye, Closing theme, Fade out",
        "isrc": "USRC12500009",
        "encoder": "Rockstar Audio Suite v1.3"
    },
    {
        "file": "sample-audio/subfolder/10-test-tone.mp3",
        "title": "Test Tone",
        "artist": "Engineering",
        "album": "Radio Jingles",
        "albumArtist": "Technical Department",
        "genre": "Utility",
        "track": "10/10",
        "disc": "1/1",
        "year": "2025",
        "composer": "Audio Engineering Team",
        "publisher": "Jingle Factory LLC",
        "copyright": "© 2025 Technical Audio Standards",
        "bpm": "0",
        "key": "A440",
        "comments": "Calibration, EBU tone, Reference level, Audio test, 1kHz sine wave, -18dBFS",
        "isrc": "USRC12500010",
        "encoder": "Rockstar Audio Suite v1.3"
    },
]

base_path = os.path.dirname(os.path.abspath(__file__))

for item in metadata:
    full_path = os.path.join(base_path, item["file"])
    
    if not os.path.exists(full_path):
        print(f"File not found: {full_path}")
        continue
    
    try:
        # Try to load existing ID3 tags
        try:
            tags = ID3(full_path)
            tags.delete()  # Clear existing tags
            tags = ID3()
        except ID3NoHeaderError:
            tags = ID3()
        
        # Set all metadata fields
        tags['TIT2'] = TIT2(encoding=3, text=item["title"])
        tags['TPE1'] = TPE1(encoding=3, text=item["artist"])
        tags['TPE2'] = TPE2(encoding=3, text=item["albumArtist"])
        tags['TALB'] = TALB(encoding=3, text=item["album"])
        tags['TCON'] = TCON(encoding=3, text=item["genre"])
        tags['TRCK'] = TRCK(encoding=3, text=item["track"])
        tags['TPOS'] = TPOS(encoding=3, text=item["disc"])
        tags['TDRC'] = TDRC(encoding=3, text=item["year"])
        tags['TCOM'] = TCOM(encoding=3, text=item["composer"])
        tags['TPUB'] = TPUB(encoding=3, text=item["publisher"])
        tags['TCOP'] = TCOP(encoding=3, text=item["copyright"])
        tags['TBPM'] = TBPM(encoding=3, text=item["bpm"])
        tags['TKEY'] = TKEY(encoding=3, text=item["key"])
        tags['COMM'] = COMM(encoding=3, lang='eng', desc='', text=item["comments"])
        tags['TSRC'] = TSRC(encoding=3, text=item["isrc"])
        tags['TENC'] = TENC(encoding=3, text=item["encoder"])
        
        # Save tags
        tags.save(full_path)
        print(f"✓ {item['file']}")
        print(f"  Title: {item['title']}")
        print(f"  Artist: {item['artist']} | Album: {item['album']}")
        print(f"  Genre: {item['genre']} | BPM: {item['bpm']} | Key: {item['key']}")
        print(f"  Composer: {item['composer']}")
        print(f"  Comments: {item['comments'][:50]}...")
        print()
        
    except Exception as e:
        print(f"✗ Error with {item['file']}: {e}")

print("Done! All metadata added.")
