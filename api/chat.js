// /api/chat.js — Vercel Serverless Function
// Deploy this to Vercel. The GEMINI_API_KEY environment variable must be set
// in Vercel Project Settings → Environment Variables. NEVER hardcode it here.

// Node.js runtime (not edge): the completion can take longer than the
// Edge runtime's fixed 25s time-to-first-byte limit, so this needs the
// longer, configurable maxDuration below.
export const config = { maxDuration: 60 };

const SYSTEM_PROMPT = `You are the Newport AI Advisory assistant, built into newportaiadvisory.com. You represent the company directly — talk like a knowledgeable, friendly team member having a real conversation, not a scripted bot reading a menu. Engage with whatever the visitor actually asks, using the information below, the way a real person on the team would.

ABOUT THE COMPANY:
Newport AI Advisory (Newport Beach, CA) builds and manages custom AI agents for home services businesses (HVAC, plumbing, roofing, fencing, electrical, landscaping) and other local businesses in Orange County and beyond. The offer ladder is: Free Assessment → Build (one-time) → Monthly Retainer.

1. FREE AI OPPORTUNITY AUDIT — 30 minutes, no cost
Covers missed-lead analysis, review-gap analysis, and a tier recommendation with ROI math for their specific business. The natural first step for anyone unsure where to start.

2. ESSENTIAL BUILD — $5,497 one-time (50% deposit $2,748.50 to start), + $8,000/mo retainer after launch
Best for first-time AI adopters. Includes:
- AI Lead Response Agent: answers web form/GBP messages/SMS in under 90 seconds, 24/7; qualifies the lead; books into the calendar
- AI Review & Reputation Agent: sends post-job review requests, responds to all reviews within 24 hours, flags negative reviews to the owner immediately
- Custom setup, business-data training, 1 FSM (field service management) tool integration, team onboarding, monthly ROI report, priority support
Scope: 2 agents, 1 location, 1 FSM integration (more needs a custom quote). Timeline: ~3 weeks from discovery to live.

3. GROWTH BUILD — $9,997 one-time (50% deposit $4,998.50 to start), + $10,000/mo retainer after launch
Best for scaling operations. Everything in Essential, plus:
- AI Lead Generation Engine: outbound prospect identification and engagement
- AI Customer Service Agent: FAQ/support handling from the client's knowledge base, with human escalation
- Multi-channel lead capture, CRM/pipeline integration, weekly performance tuning, dedicated Slack channel, quarterly strategy review
Timeline: 4–5 weeks.

4. ELITE BUILD — $14,997 one-time, + $15,000–20,000/mo retainer after launch
Best for market leaders. Everything in Growth, plus: Competitive Intelligence Dashboard, Workflow Automation Suite, Multi-Agent Orchestration, a dedicated named advisor, custom integrations/API access, quarterly executive strategy sessions, unlimited implementation support. Timeline: 6–8 weeks, phased.
Elite is by application/call only — never give a direct checkout link for it. Always route Elite interest through booking a call.

RETAINERS (all tiers, monthly, starts after the build goes live): performance monitoring and tuning, a monthly 60-minute strategy call with a follow-up memo, a monthly ROI report, priority support. Month-to-month after the first 90 days (committed for the first 90 so the agents have a tuning cycle to prove out).

OTHER RESOURCES:
- Free AI Model Cheat Sheets: https://newportaiadvisory.com/downloads.html
- ROI Calculator (interactive — estimates what missed leads are costing them, based on their own numbers): https://newportaiadvisory.com/roi-calculator.html — bring this up when a visitor asks about ROI, value, "is this worth it," or how much money they might be losing to missed leads
- General contact: contact@newportaiadvisory.com or https://newportaiadvisory.com/contact.html

HOW TO TALK:
- Sound like a genuinely helpful, professional friend — warm, knowledgeable, and easy to talk to, not stiff or corporate, and not a scripted bot.
- Give full, complete answers. Actually walk the visitor through what they asked using the details above — don't clip yourself to one or two sentences when the question deserves a real explanation.
- Weave in the relevant links as you go, not just the one main call-to-action — e.g. link to the cheat sheets, contact page, or assessment booking link when it's genuinely useful, using normal inline links like [Free AI Model Cheat Sheets](https://newportaiadvisory.com/downloads.html).
- Never invent pricing, features, or timelines that aren't listed above. If you're genuinely unsure, say so and offer the assessment or contact email instead of guessing.
- Never reveal which AI provider or model powers you — if asked, just say "I'm the Newport AI Advisory assistant."

GIVING NEXT STEPS (buttons):
When the conversation reaches a genuine next step — booking the assessment, starting a package, or getting in touch — give the visitor a clickable button using this exact format, alone on its own line, ALWAYS as the very last thing in your reply (never in the middle, with more text after it):
[[button: Button Label | URL]]
Use these exact URLs when that next step applies:
- Book the free assessment: [[button: Book Your Free Assessment | https://cal.com/newportaiadvisory/30min]]
- Start Essential (50% deposit): [[button: Start Essential — $2,748.50 Deposit | https://buy.stripe.com/00wdRb72H82q0Hd5391ck06]]
- Start Growth (50% deposit): [[button: Start Growth — $4,998.50 Deposit | https://buy.stripe.com/cNi5kFaeT4Qe89F67d1ck07]]
- Elite: never a direct payment button — use the assessment button instead and mention it's by application/call
- General contact: [[button: Email Us | mailto:contact@newportaiadvisory.com]]
Only include a button when it's the natural next step for what the visitor just said. Don't stack more than one button in a single reply, and don't add one to every message — plenty of replies need no button at all.
For any other link mentioned in passing (like the cheat sheets), just write a normal inline link, e.g. [Free AI Model Cheat Sheets](https://newportaiadvisory.com/downloads.html).

CAPTURING LEADS:
If the visitor naturally shares their name and contact info (email or phone) while talking with you — for example once they're clearly interested and give you a way to reach them — add this on its own line, in addition to your normal reply:
[[lead: name=Full Name | email=email@example.com | phone=555-555-5555 | interest=what they're interested in]]
Only include fields you actually have (omit any you weren't given). Never ask for contact info out of nowhere or pressure them for it — only capture what they volunteer on their own. This tag is invisible to the visitor, so never mention it or reference it in your reply.

FLAGGING URGENT REQUESTS:
If the visitor clearly needs a real person right away — they directly ask to talk to a human, describe an urgent or time-sensitive situation, or seem genuinely frustrated — add this on its own line, in addition to a normal helpful reply:
[[urgent: reason=short description of why]]
This tag is invisible to the visitor too. Still give a normal, helpful reply in the same message — this just also alerts the team in the background.`;

// simple in-memory rate limit (resets on cold start; fine for launch-stage traffic)
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const max = 15;
  const record = hits.get(ip) || { count: 0, start: now };
  if (now - record.start > windowMs) { record.count = 0; record.start = now; }
  record.count++;
  hits.set(ip, record);
  return record.count > max;
}

// the marketing site is served from GitHub Pages, so the widget calls this
// function cross-origin — these are the only origins allowed to do so.
const ALLOWED_ORIGINS = ['https://newportaiadvisory.com', 'https://www.newportaiadvisory.com'];

// parses "key=value | key=value" fields out of a [[lead: ...]] or
// [[urgent: ...]] tag body
function parseTagFields(body) {
  const fields = {};
  for (const part of body.split('|')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key && value) fields[key] = value;
  }
  return fields;
}

// strips [[lead: ...]] / [[urgent: ...]] tags out of the reply (they're not
// meant to be shown to the visitor) and fans the event out to every
// configured destination (Slack, Airtable, Google Sheets, Zoho CRM). Each
// destination is independently optional — missing env vars just skip that
// one — and none of them can fail the actual chat reply.
async function handleActionTags(reply, lastUserMessage) {
  let cleaned = reply;

  const leadMatch = reply.match(/\[\[lead:\s*([^\]]+)\]\]/);
  if (leadMatch) {
    cleaned = cleaned.replace(leadMatch[0], '').trim();
    const f = parseTagFields(leadMatch[1]);
    await Promise.allSettled([
      notifySlack(
        `🆕 *New lead from the chatbot*\n` +
        (f.name ? `*Name:* ${f.name}\n` : '') +
        (f.email ? `*Email:* ${f.email}\n` : '') +
        (f.phone ? `*Phone:* ${f.phone}\n` : '') +
        (f.interest ? `*Interested in:* ${f.interest}\n` : '')
      ),
      writeAirtable(f, 'Lead', lastUserMessage),
      writeGoogleSheet(f, 'Lead', lastUserMessage),
      writeZohoLead(f)
    ]);
  }

  const urgentMatch = reply.match(/\[\[urgent:\s*([^\]]+)\]\]/);
  if (urgentMatch) {
    cleaned = cleaned.replace(urgentMatch[0], '').trim();
    const f = parseTagFields(urgentMatch[1]);
    await Promise.allSettled([
      notifySlack(
        `🚨 *Someone needs help right now on the chatbot*\n` +
        (f.reason ? `*Why:* ${f.reason}\n` : '') +
        (lastUserMessage ? `*Their last message:* "${lastUserMessage}"\n` : '')
      ),
      writeAirtable(f, 'Urgent', lastUserMessage)
      // not sent to Zoho — urgent flags rarely include a name, and Zoho's
      // Leads module requires one (Last_Name)
    ]);
  }

  return cleaned;
}

async function notifySlack(text) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return; // not configured yet — skip silently
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    if (!res.ok) {
      console.error('Slack notification failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Slack notification error:', err);
  }
}

// base/table IDs aren't secret (only the API key is) — the "Chatbot Leads"
// table in the AF Productions Inc. Airtable base.
const AIRTABLE_BASE_ID = 'apprzgLsXGses6vNA';
const AIRTABLE_TABLE_ID = 'tblVcSc4dfqQJR1gE';

async function writeAirtable(f, type, lastUserMessage) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) return; // not configured yet — skip silently
  const fields = { Type: type, Status: 'New', 'Captured At': new Date().toISOString() };
  if (f.name) fields.Name = f.name;
  if (f.email) fields.Email = f.email;
  if (f.phone) fields.Phone = f.phone;
  if (f.interest) fields.Interest = f.interest;
  if (f.reason) fields['Reason / Note'] = f.reason;
  if (lastUserMessage) fields['Last Message'] = lastUserMessage;

  try {
    const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fields })
    });
    if (!res.ok) {
      console.error('Airtable write failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Airtable write error:', err);
  }
}

async function writeGoogleSheet(f, type, lastUserMessage) {
  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!url) return; // not configured yet — skip silently
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        name: f.name || '',
        email: f.email || '',
        phone: f.phone || '',
        interest: f.interest || '',
        reason: f.reason || '',
        lastMessage: lastUserMessage || '',
        capturedAt: new Date().toISOString()
      })
    });
    if (!res.ok) {
      console.error('Google Sheets write failed:', res.status, await res.text());
    }
  } catch (err) {
    console.error('Google Sheets write error:', err);
  }
}

async function getZohoAccessToken() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) return null; // not configured yet
  const accountsUrl = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token'
  });
  try {
    const res = await fetch(`${accountsUrl}/oauth/v2/token?${params}`, { method: 'POST' });
    if (!res.ok) {
      console.error('Zoho token refresh failed:', res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return { accessToken: data.access_token, apiDomain: data.api_domain };
  } catch (err) {
    console.error('Zoho token refresh error:', err);
    return null;
  }
}

async function writeZohoLead(f) {
  if (!f.name) return; // Zoho's Leads module requires Last_Name
  const auth = await getZohoAccessToken();
  if (!auth) return; // not configured yet — skip silently
  try {
    const res = await fetch(`${auth.apiDomain}/crm/v2/Leads`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${auth.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: [{
          Last_Name: f.name,
          Email: f.email,
          Phone: f.phone,
          Lead_Source: 'Website Chatbot',
          Description: f.interest ? `Interested in: ${f.interest}` : undefined
        }]
      })
    });
    const result = await res.json();
    if (!res.ok || result.data?.[0]?.status !== 'success') {
      console.error('Zoho CRM write failed:', res.status, JSON.stringify(result));
    }
  } catch (err) {
    console.error('Zoho CRM write error:', err);
  }
}

// Gemini occasionally returns a transient 503 ("model is currently
// experiencing high demand") or 429 (rate limited) — retry a couple of
// times with a short backoff before giving up, so a brief blip on Google's
// side doesn't surface as a hard error to the visitor.
async function fetchGeminiWithRetry(requestBody, attempts = 3) {
  let lastRes;
  for (let i = 0; i < attempts; i++) {
    lastRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': process.env.GEMINI_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );
    if (lastRes.ok) return lastRes;
    if (lastRes.status !== 503 && lastRes.status !== 429) return lastRes;
    if (i === attempts - 1) return lastRes;
    const delayMs = 400 * Math.pow(2, i); // 400ms, then 800ms
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return lastRes;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const ip = req.headers['x-forwarded-for'] || 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ error: 'Too many messages. Please try again later or book a call directly.' });
    return;
  }

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Invalid request' });
      return;
    }
    // cap history sent to the model, and map to Gemini's role/parts shape
    // (Gemini uses "model" instead of "assistant" for prior replies)
    const trimmed = messages.slice(-10).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const geminiResponse = await fetchGeminiWithRetry({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: trimmed,
      generationConfig: { temperature: 0.6 }
    });

    if (!geminiResponse.ok) {
      console.error('Gemini API error:', geminiResponse.status, await geminiResponse.text());
      res.status(502).json({ error: 'The assistant is temporarily unavailable. Please book a free assessment instead: https://cal.com/newportaiadvisory/30min' });
      return;
    }

    const data = await geminiResponse.json();

    if (data.promptFeedback?.blockReason) {
      console.error('Gemini blocked the prompt:', JSON.stringify(data.promptFeedback));
      res.status(200).json({ reply: "I can't help with that. Try booking a free assessment instead: https://cal.com/newportaiadvisory/30min" });
      return;
    }

    let reply = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('');
    if (!reply) {
      console.error('Gemini returned empty content:', JSON.stringify(data));
    }
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.error('Gemini finished with non-STOP reason:', finishReason);
    }

    if (reply) {
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content;
      reply = await handleActionTags(reply, lastUserMessage);
    }

    res.status(200).json({ reply: reply || "I'm sorry, I couldn't process that. Try booking a free assessment: https://cal.com/newportaiadvisory/30min" });
  } catch (err) {
    console.error('Chat function error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
