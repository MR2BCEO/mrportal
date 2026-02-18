import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ico } = await req.json();

    if (!ico || typeof ico !== "string" || ico.length < 2 || ico.length > 8) {
      return new Response(JSON.stringify({ error: "Neplatné IČO" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paddedIco = ico.padStart(8, "0");

    // Use the new ARES REST API
    const aresUrl = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${paddedIco}`;

    console.log("Fetching ARES:", aresUrl);

    const response = await fetch(aresUrl, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "MujRevizak/1.0",
      },
    });

    console.log("ARES status:", response.status, "content-type:", response.headers.get("content-type"));

    if (!response.ok) {
      const text = await response.text();
      console.log("ARES error body:", text.substring(0, 500));
      if (response.status === 404 || response.status === 422) {
        return new Response(JSON.stringify({ error: "IČO nenalezeno v registru" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`ARES returned ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      // Fallback: try text and parse
      const text = await response.text();
      console.log("Non-JSON response:", text.substring(0, 300));
      throw new Error("ARES returned non-JSON response");
    }

    const data = await response.json();

    const sidlo = data.sidlo || {};
    const result = {
      name: data.obchodniJmeno || "",
      ico: data.ico || paddedIco,
      dic: data.dic || "",
      address_line: [
        sidlo.nazevUlice,
        sidlo.cisloDomovni
          ? `${sidlo.cisloDomovni}${sidlo.cisloOrientacni ? `/${sidlo.cisloOrientacni}` : ""}`
          : "",
      ]
        .filter(Boolean)
        .join(" ") || "",
      city: sidlo.nazevObce || "",
      zip: sidlo.psc ? String(sidlo.psc) : "",
    };

    console.log("ARES result:", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ARES lookup error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Chyba při vyhledávání v registru" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
