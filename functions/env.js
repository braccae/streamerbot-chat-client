export async function onRequest(context) {
    // Catch the environment variable from Cloudflare Pages settings.
    // We provide a fallback for local development if it's not set.
    const backendUrl = context.env.TIKTOK_BACKEND || 'ws://localhost:8081';

    return new Response(JSON.stringify({ backendUrl }), {
        headers: {
            'Content-Type': 'application/json',
        },
    });
}
