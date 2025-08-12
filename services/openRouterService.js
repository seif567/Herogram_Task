const axios = require('axios');
const { pool } = require('../database');
require('dotenv').config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Function to generate painting ideas using OpenRouter with function calling
async function generateIdeas(titleId, titleText, instructions, previousIdeas = []) {
  try {
    if (!titleId) {
      throw new Error('Title ID is required for idea generation');
    }
    
    if (!titleText) {
      throw new Error('Title text is required for idea generation');
    }
    
    // Get previous ideas for context
    const previousIdeasSummary = previousIdeas.length > 0 
      ? `Previous painting ideas: ${previousIdeas.map(idea => idea.summary).join('; ')}`
      : '';
    
    if (!OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key is missing. Please check your .env file.');
    }
    
    const response = await axios.post(OPENROUTER_URL, {
      model: 'google/gemini-2.5-pro-preview', // You can choose a different model
      messages: [
        { role: 'system', content: 'You are a creative painting designer. Generate unique painting concepts that haven\'t been suggested before.' },
        { role: 'user', content: `Create a painting concept for the title: "${titleText}".
          ${instructions ? `Custom instructions: ${instructions}` : ''}
          ${previousIdeasSummary}
          Please generate a completely new and different painting idea that hasn't been suggested yet.`
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'savePaintingIdea',
          description: 'Save a painting idea',
          parameters: {
            type: 'object',
            properties: {
              summary: {
                type: 'string',
                description: 'A short summary of the painting idea (30-50 words)'
              },
              fullPrompt: {
                type: 'string',
                description: 'The full prompt to generate this painting image (100-200 words with detailed visual instructions)'
              }
            },
            required: ['summary', 'fullPrompt']
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'savePaintingIdea' } }
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const toolCall = response.data.choices[0].message.tool_calls[0];
    const ideaData = JSON.parse(toolCall.function.arguments);

    if (!ideaData.summary || !ideaData.fullPrompt) {
      throw new Error('Incomplete idea data received from AI');
    }

    // Save to database
    const params = [titleId, ideaData.summary, ideaData.fullPrompt];
    // Validate parameters
    if (params.some(p => p === undefined)) {
      console.error('Attempted to execute query with undefined parameter:', { params });
      throw new Error('Invalid query parameter detected');
    }
    
    const [result] = await pool.execute(
      'INSERT INTO ideas (title_id, summary, full_prompt) VALUES (?, ?, ?)',
      params
    );

    const idea = {
      id: result.insertId,
      titleId,
      summary: ideaData.summary,
      fullPrompt: ideaData.fullPrompt
    };

    return idea;
  } catch (error) {
    console.error('Error generating ideas:', error);
    throw error;
  }
}

// Function to regenerate a prompt for safety violations
async function regeneratePrompt(ideaId, titleText, instructions, previousIdeas = []) {
  try {
    if (!ideaId) {
      throw new Error('Idea ID is required for prompt regeneration');
    }
    
    if (!titleText) {
      throw new Error('Title text is required for prompt regeneration');
    }
    
    // Get previous ideas for context
    const previousIdeasSummary = previousIdeas.length > 0 
      ? `Previous painting ideas: ${previousIdeas.map(idea => idea.summary).join('; ')}`
      : '';
    
    if (!OPENROUTER_API_KEY) {
      throw new Error('OpenRouter API key is missing. Please check your .env file.');
    }
    
    const response = await axios.post(OPENROUTER_URL, {
      model: 'google/gemini-2.5-pro-preview',
      messages: [
        { role: 'system', content: 'You are a creative painting designer. Generate a new, safer painting concept that avoids any content that might violate safety guidelines.' },
        { role: 'user', content: `The previous prompt for "${titleText}" was rejected due to safety concerns. 
          ${instructions ? `Custom instructions: ${instructions}` : ''}
          ${previousIdeasSummary}
          Please generate a completely new, safer painting idea that maintains the artistic vision while avoiding any potentially problematic content.`
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'savePaintingIdea',
          description: 'Save a safer painting idea',
          parameters: {
            type: 'object',
            properties: {
              summary: {
                type: 'string',
                description: 'A short summary of the safer painting idea (30-50 words)'
              },
              fullPrompt: {
                type: 'string',
                description: 'The full prompt to generate this painting image (100-200 words with detailed visual instructions, avoiding any potentially problematic content)'
              }
            },
            required: ['summary', 'fullPrompt']
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'savePaintingIdea' } }
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const toolCall = response.data.choices[0].message.tool_calls[0];
    const ideaData = JSON.parse(toolCall.function.arguments);

    if (!ideaData.summary || !ideaData.fullPrompt) {
      throw new Error('Incomplete idea data received from AI');
    }

    // Update the existing idea in database
    const params = [ideaData.summary, ideaData.fullPrompt, ideaId];
    // Validate parameters
    if (params.some(p => p === undefined)) {
      console.error('Attempted to execute query with undefined parameter:', { params });
      throw error;
    }
    
    await pool.execute(
      'UPDATE ideas SET summary = ?, full_prompt = ? WHERE id = ?',
      params
    );

    return {
      id: ideaId,
      summary: ideaData.summary,
      fullPrompt: ideaData.fullPrompt
    };
  } catch (error) {
    console.error('Error regenerating prompt:', error);
    throw error;
  }
}

module.exports = {
  generateIdeas,
  regeneratePrompt
}; 