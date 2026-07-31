const url = "https://pkeijxgwxbtxoxnxbqnj.supabase.co";
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrZWlqeGd3eGJ0eG94bnhicW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NTY1MzAsImV4cCI6MjA4OTQzMjUzMH0.gk2GnnQzYhMhpn9UdRWWIlrTEJo98C0MWdQYaURr5aY";

async function run() {
  console.log("Signing in as admin...");
  const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "apikey": anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "palengclickadmin2026@palengclick.com",
      password: "palengclickadmin2026"
    })
  });

  const authData = await authResponse.json();
  const token = authData.access_token;

  console.log("Inserting profile for cashier user...");
  const insertResponse = await fetch(`${url}/rest/v1/profiles`, {
    method: "POST",
    headers: {
      "apikey": anonKey,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify({
      user_id: "e30ffcad-5f01-41d5-b0c7-373044b4c28d",
      first_name: "PalengClick",
      last_name: "Cashier",
      status: "active"
    })
  });

  console.log("Insert response status:", insertResponse.status);
  const data = await insertResponse.json();
  console.log("Insert response data:", data);
}

run().catch(console.error);
