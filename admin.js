const supabaseUrl = "https://bkvvyissajffmhcdduof.supabase.co";
const supabaseKey = "sb_publishable_FVnD6MyrqCoOqsrO8yI71g_uP5zi-Bv";

const supabaseClient = supabase.createClient(
    supabaseUrl,
    supabaseKey,
    {
        auth: {
            persistSession: true,
            storage: localStorage,
            autoRefreshToken: true,
            detectSessionInUrl: true
    }
    }
);

const loginBox = document.getElementById("loginBox");
const adminPanel = document.getElementById("adminPanel");

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("logoutBtn").addEventListener("click", logout);

async function login() {

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

    console.log("LOGIN RESULT:", data);
    console.log("SESSION:", data.session);
    console.log("USER:", data.user);

    if (error) {
        alert(error.message);
        return;
    }

    const user = data.user;

    const { data: roleData } = await supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

    console.log("Role: ", roleData);

    if (roleData?.role !== "admin") {
        alert("Not admin");
        await supabaseClient.auth.signOut();
        return;
    }

    loginBox.style.display = "none";
    adminPanel.style.display = "block";

    loadQueue();
}

async function logout() {
    await supabaseClient.auth.signOut();
    location.reload();
}

document
    .getElementById("callNextBtn")
    .addEventListener("click", callNext);

async function callNext() {

    const { data, error } = await supabaseClient
        .from("queue_entries")
        .select("*")
        .eq("status", "waiting")
        .order("checked_in_at", { ascending: true })
        .limit(1);

    if (error || !data.length) {
        console.log("No users");
        return;
    }

    const next = data[0];

    await supabaseClient
        .from("queue_entries")
        .update({
            status: "called",
            called_at: new Date().toISOString()
        })
        .eq("id", next.id);

    console.log("Called:", next.ticket_number);

    loadQueue();
}

async function loadQueue() {

    const { data } = await supabaseClient
        .from("queue_entries")
        .select("*")
        .order("checked_in_at", { ascending: true });

    const div = document.getElementById("queueList");

    div.innerHTML = data.map(q =>
        `<p>${q.ticket_number} - ${q.status}</p>`
    ).join("");
}

async function clearQueue() {

    if (!confirm("Clear entire queue?")) return;

    const { error } = await supabaseClient
        .from("queue_entries")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
        alert(error.message);
    }
}


