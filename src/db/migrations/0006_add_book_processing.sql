-- Migration: Add book processing support
-- Adds detected_category and book_metadata to raw_inspirations
-- Creates book_extractions table for deep book analysis

-- Add new columns to raw_inspirations
ALTER TABLE raw_inspirations 
ADD COLUMN IF NOT EXISTS book_metadata JSONB,
ADD COLUMN IF NOT EXISTS detected_category VARCHAR(50);

-- Create index for detected_category filtering
CREATE INDEX IF NOT EXISTS idx_raw_inspirations_category 
ON raw_inspirations(workspace_id, detected_category) 
WHERE detected_category IS NOT NULL;

-- Create book_extractions table
CREATE TABLE IF NOT EXISTS book_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_inspiration_id UUID NOT NULL REFERENCES raw_inspirations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Identification
    title VARCHAR(500) NOT NULL,
    authors TEXT[] NOT NULL DEFAULT '{}',
    isbn VARCHAR(20),
    isbn13 VARCHAR(20),
    publication_year INTEGER,
    publisher VARCHAR(255),
    genre TEXT[] NOT NULL DEFAULT '{}',
    category VARCHAR(100),
    language VARCHAR(10),
    page_count INTEGER,
    identification_confidence REAL,
    
    -- Semantic Core (JSONB for flexibility)
    semantic_core JSONB NOT NULL,
    
    -- Themes and Patterns
    themes_and_patterns JSONB NOT NULL,
    
    -- Knowledge Connections
    knowledge_connections JSONB NOT NULL,
    
    -- Content Generation Guidelines
    content_generation_guidelines JSONB NOT NULL,
    
    -- Processing Metadata
    llm_model VARCHAR(50),
    tokens_used INTEGER,
    vision_used INTEGER DEFAULT 0,
    external_sources_used TEXT[] NOT NULL DEFAULT '{}',
    processing_duration_ms INTEGER,
    
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for book_extractions
CREATE INDEX IF NOT EXISTS idx_book_extractions_workspace 
ON book_extractions(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_extractions_inspiration 
ON book_extractions(raw_inspiration_id);

CREATE INDEX IF NOT EXISTS idx_book_extractions_title 
ON book_extractions(workspace_id, title);

-- Add comment
COMMENT ON TABLE book_extractions IS 'Deep semantic extractions for book-type inspirations';
COMMENT ON COLUMN raw_inspirations.detected_category IS 'Auto-detected content category: book, article, video, social_post, podcast, course, other';
COMMENT ON COLUMN raw_inspirations.book_metadata IS 'Enriched book metadata from Google Books API or Vision analysis';

