import { Generation } from './types';

// Simple hash for deterministic but varied results per topic
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function getRandomFromArray<T>(arr: T[], seed: number, count: number): T[] {
  const result: T[] = [];
  let currentSeed = seed;
  const used = new Set<number>();
  
  for (let i = 0; i < count && i < arr.length; i++) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    let idx = Math.floor((currentSeed / 233280) * arr.length);
    
    // Avoid duplicates
    let attempts = 0;
    while (used.has(idx) && attempts < 10) {
      idx = (idx + 1) % arr.length;
      attempts++;
    }
    used.add(idx);
    result.push(arr[idx]);
  }
  return result;
}

const captionTemplates = [
  "🚀 Struggling with [TOPIC]? This one change completely transformed how I approach it. The results speak for themselves.",
  "The [TOPIC] hack nobody talks about (but everyone should be using). I tested it for 30 days — here’s what happened.",
  "Stop scrolling if you care about [TOPIC]. This simple framework helped me 10x my results in under a month.",
  "Real talk: Most people fail at [TOPIC] because they skip this step. Don’t be most people.",
  "I went from overwhelmed to consistent with [TOPIC] using this exact 3-step system. Swipe for the breakdown 👇",
  "Hot take: The best [TOPIC] advice isn’t complicated. It’s this one principle that changes everything.",
  "POV: You finally found the [TOPIC] strategy that actually works in 2026. Save this for later.",
  "If you only remember one thing about [TOPIC] this year, make it this. Your future self will thank you.",
  "The [TOPIC] mistake costing you time (and results). Here’s exactly how to fix it.",
  "From zero to consistent results with [TOPIC] — the exact playbook I wish I had 6 months ago.",
  "Quick win for [TOPIC]: Do this one thing today and you’ll see progress by tomorrow.",
  "Why your [TOPIC] isn’t working (and the 2-minute fix that changed everything for me).",
  "This [TOPIC] tip is so effective it should be illegal. Use responsibly.",
  "The secret to [TOPIC] that 99% of people ignore. I almost missed it too.",
  "Tired of generic [TOPIC] advice? Here’s the specific, actionable version that actually moves the needle.",
];

const threadHooks = [
  "The ultimate [TOPIC] thread you didn’t know you needed 🧵",
  "I cracked the code on [TOPIC]. Here’s the full playbook:",
  "Everything I know about [TOPIC] after [X] months of testing:",
  "If you’re serious about [TOPIC], read this thread. It might save you months.",
  "The complete beginner-to-pro [TOPIC] system (no fluff):",
];

const threadPoints = [
  "1/ Start with the end in mind. What does success in [TOPIC] actually look like for you?",
  "2/ Consistency beats intensity. Small daily actions compound faster than weekend warriors.",
  "3/ Track the right metric. Vanity metrics lie — focus on the one that predicts real progress.",
  "4/ Remove friction. The easier it is to do the thing, the more likely you are to do it.",
  "5/ Review weekly. What worked? What didn’t? Adjust and repeat.",
  "6/ Get accountability. Tell one person your goal. It dramatically increases follow-through.",
  "7/ Celebrate small wins. Momentum is everything in [TOPIC].",
];

const videoHooks = [
  "Most people think [TOPIC] is hard. It’s not — you’re just doing it wrong.",
  "The [TOPIC] secret that took me from stuck to unstoppable in 14 days.",
  "I tried every [TOPIC] method. This is the only one that actually worked.",
  "If you’re struggling with [TOPIC], watch this before you give up.",
  "The 60-second [TOPIC] habit that changed my entire trajectory.",
];

const ctaPhrases = [
  "Save this for when you need it most.",
  "Which one are you trying first? Comment below.",
  "Tag someone who needs to see this.",
  "DM me “SPARK” if you want the full template.",
  "What’s your biggest [TOPIC] challenge right now?",
];

export function generateContent(topic: string): Omit<Generation, 'id' | 'createdAt'> {
  const seed = hashString(topic.toLowerCase().trim());
  const lowerTopic = topic.toLowerCase();

  // Normalize topic for natural insertion
  const displayTopic = topic.trim();
  const shortTopic = displayTopic.length > 25 ? displayTopic.substring(0, 22) + '...' : displayTopic;

  // Generate 10 captions
  const selectedCaptions = getRandomFromArray(captionTemplates, seed, 10).map(template => {
    let caption = template.replace(/\[TOPIC\]/g, shortTopic);
    // Add a CTA occasionally
    if (Math.random() > 0.6) {
      const cta = getRandomFromArray(ctaPhrases, seed + 42, 1)[0];
      caption = caption + " " + cta;
    }
    // Add emoji boost if missing
    if (!caption.match(/[🚀🔥💡✨]/)) {
      caption = "✨ " + caption;
    }
    return caption;
  });

  // 5 thread ideas
  const baseHook = getRandomFromArray(threadHooks, seed + 7, 1)[0].replace('[TOPIC]', shortTopic);
  const selectedThreads = getRandomFromArray(threadPoints, seed + 13, 5).map(p => 
    p.replace(/\[TOPIC\]/g, shortTopic)
  );
  const threads = [baseHook, ...selectedThreads];

  // Hashtags - smart + popular
  const topicWords = displayTopic.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3);
  const baseHashtags = [
    '#ContentCreation', '#CreatorEconomy', '#SocialMediaTips', '#GrowthHacking', 
    '#MarketingTips', '#PersonalBrand', '#ViralContent', '#ContentStrategy'
  ];
  const relevant = topicWords.map(w => `#${w.replace(/[^a-z]/g, '')}Tips`).slice(0, 3);
  const allHashtags = [...new Set([...relevant, ...getRandomFromArray(baseHashtags, seed + 99, 5)])];
  const hashtags = allHashtags.slice(0, 8);

  // Video hook
  const rawHook = getRandomFromArray(videoHooks, seed + 21, 1)[0].replace('[TOPIC]', shortTopic);
  const videoHook = rawHook + " " + getRandomFromArray(ctaPhrases, seed + 55, 1)[0];

  return {
    topic: displayTopic,
    captions: selectedCaptions,
    threads: threads,
    hashtags,
    videoHook,
  };
}
