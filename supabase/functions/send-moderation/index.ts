import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_BOT_TOKEN = Deno.env.get('ADMIN_BOT_TOKEN')!;
const TELEGRAM_ADMIN_CHAT_ID = Deno.env.get('TELEGRAM_ADMIN_CHAT_ID')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Get or create short ID for article
async function getOrCreateShortId(articleId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_short_id', { p_article_id: articleId });
  
  if (error) {
    console.error('Error getting short ID:', error);
    return articleId.substring(0, 8);
  }
  
  return data;
}

async function sendTelegramMessage(chatId: string | number, text: string, options: any = {}) {
  const url = `https://api.telegram.org/bot${ADMIN_BOT_TOKEN}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...options,
    }),
  });
  
  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { articleId } = await req.json();
    console.log('Sending moderation request for article:', articleId);

    // Get article with author info
    const { data: article, error } = await supabase
      .from('articles')
      .select('*, author:author_id(first_name, username, telegram_id)')
      .eq('id', articleId)
      .maybeSingle();

    if (error || !article) {
      console.error('Error fetching article:', error);
      return new Response(
        JSON.stringify({ error: 'Article not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate short ID for moderation buttons
    const shortId = await getOrCreateShortId(article.id);

    const authorData = article.author as any;

    // Determine media display - don't send full base64, just indicate presence
    let mediaDisplay = '';
    if (article.media_url) {
      if (article.media_url.startsWith('data:')) {
        mediaDisplay = '🖼 <b>Медиа:</b> Изображение (загружено)';
      } else if (article.media_type === 'youtube') {
        mediaDisplay = `🎬 <b>Медиа:</b> YouTube видео`;
      } else {
        mediaDisplay = `🖼 <b>Медиа:</b> ${article.media_url.substring(0, 50)}...`;
      }
    }

    const message = `🆕 <b>Новая статья на модерации</b>

📝 <b>Заголовок:</b> ${article.title}

👤 <b>Автор:</b> ${article.is_anonymous ? 'Аноним' : authorData?.first_name || 'Unknown'} ${authorData?.username ? `(@${authorData.username})` : ''}

📄 <b>Превью:</b>
${article.preview || article.body?.substring(0, 300) || 'Нет превью'}...

${mediaDisplay}`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '✅ Принять', callback_data: `approve:${shortId}` },
          { text: '❌ Отклонить', callback_data: `reject:${shortId}` },
        ],
      ],
    };

    const result = await sendTelegramMessage(TELEGRAM_ADMIN_CHAT_ID, message, {
      reply_markup: keyboard,
    });

    console.log('Telegram API response:', result);

    // Store message ID for later reference
    if (result.ok && result.result?.message_id) {
      await supabase
        .from('articles')
        .update({ telegram_message_id: result.result.message_id })
        .eq('id', articleId);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: result.result?.message_id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending moderation request:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
