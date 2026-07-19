# Data Storage Structure

This directory contains organized data storage for the Caro Bot application.

## Directory Structure

```
data/
├── history/      # Game history and match records
├── learning/     # Bot learning data and patterns
├── replay/       # Game replay data for analysis
├── config/       # Configuration files and settings
└── stats/        # Statistics and analytics data
```

## Usage

### History
- Stores completed game records
- Used for ranking and statistics
- Format: JSON files per match

### Learning
- Bot pattern memory and training data
- Adaptive learning storage
- Format: JSON files for patterns

### Replay
- Game replay data for analysis
- Move sequences and board states
- Format: JSON files per game

### Config
- User preferences and settings
- Custom configurations
- Format: JSON files

### Stats
- Performance statistics
- Analytics data
- Format: JSON files

## Migration Notes

The old storage system used localStorage directly. The new system:
- Uses this organized directory structure
- Maintains backward compatibility with localStorage
- Allows for easier data export/import
- Supports future cloud synchronization
