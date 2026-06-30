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

let isAdminInitialized = false;

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

    if (!isAdminInitialized) {

        await loadQueue();
        await loadStats();
        subscribeRealtime();
        isAdminInitialized = true;
    }
}

async function logout() {
    await supabaseClient.auth.signOut();
    location.reload();
}

document.addEventListener("DOMContentLoaded", () => {

    const btn =
        document.getElementById("callNextBtn");

    if (btn) {
        btn.addEventListener(
            "click",
            callNextPerson
        );
    }
}); 

function subscribeRealtime() {

    supabaseClient
        .channel("admin_queue")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "queue_entries"
            },
            () => {
                loadQueue();
                loadStats();
            }
        )
        .subscribe();

}

const loginBox = document.getElementById("loginBox");
const adminPanel = document.getElementById("adminPanel");

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("logoutBtn").addEventListener("click", logout);



async function callNextPerson() {

    const { data, error } = await supabaseClient.rpc(
        "call_next_person"
    );

    if (error) {
        alert(error.message);
        return;
    }

    if (!data?.success) {
        alert(data?.message || "No ticket");
        return;
    }

    console.log("Now calling:", data.ticket_number);

    await loadQueue();
    await loadStats();
}

async function loadQueue() {

    const { data, error } =
        await supabaseClient
            .from("queue_entries")
            .select("*")
            .in("status", ["waiting", "called"])
            .order("checked_in_at");

    if (error) {
        console.error(error);
        return;
    }

    renderQueue(data);

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

function minutesWaiting(timestamp) {

    const start = new Date(timestamp);
    const now = new Date();

    return Math.floor(
        (now - start) / 60000
    );
}

function renderQueue(entries) {

    const list = document.getElementById("queueList");
    list.innerHTML = "";

    const called = entries.filter(e => e.status === "called");
    const waiting = entries.filter(e => e.status === "waiting");

    // 1. ACTIVE (CALLED)
    const activeBox = document.createElement("div");
    activeBox.innerHTML = `<h3>Currently Called</h3>`;

    if (called.length === 0) {
        activeBox.innerHTML += `<p>No active ticket</p>`;
    }

    called.forEach(entry => {

        const row = document.createElement("div");

        row.innerHTML = `
            <b>🎫 ${entry.ticket_number}</b><br>
            Status: ${entry.status}<br>
            Waiting: ${minutesWaiting(entry.checked_in_at)} min<br>

            <button onclick="markDone('${entry.id}')">Done</button>
            <button onclick="markMissed('${entry.id}')">Missed</button>
            <button onclick="cancelEntry('${entry.id}')">Cancel</button>
        `;

        activeBox.appendChild(row);
    });

    list.appendChild(activeBox);

    // 2. WAITING LIST
    const waitingBox = document.createElement("div");
    waitingBox.innerHTML = `<h3>Waiting Queue</h3>`;

    waiting.forEach(entry => {

        const row = document.createElement("div");

        row.innerHTML = `
            <b>${entry.ticket_number}</b>
            | ${minutesWaiting(entry.checked_in_at)} min

            <button onclick="callSpecific('${entry.id}')">
                Call
            </button>
        `;

        waitingBox.appendChild(row);
    });

    list.appendChild(waitingBox);
}

async function markDone(id) {

    const { data: entry } = await supabaseClient
        .from("queue_entries")
        .select("status")
        .eq("id", id)
        .single();

    let newStatus = "done";

    // wenn nie aufgerufen → missed statt done
    if (entry.status === "waiting") {
        newStatus = "missed";
    }

    const { error } =
        await supabaseClient.rpc("update_queue_status", {
            p_id: id,
            p_new_status: newStatus
        });

    if (error) {
        console.error(error);
        return;
    }

    await loadQueue();
    await loadStats();
}

async function cancelEntry(id) {

    const { error } =
        await supabaseClient.rpc("update_queue_status", {
            p_id: id,
            p_new_status: "cancelled"
        });

    if (error) {
        console.error(error);
        return;
    }

    await loadQueue();
    await loadStats();

}

async function loadStats() {

    const { data, error } =
        await supabaseClient
            .from("queue_stats")
            .select("*")
            .single();

    if (error) {
        console.error(error);
        return;
    }

    document.getElementById("statsBox").innerHTML = `
        Waiting: ${data.waiting}<br>
        Called: ${data.called}<br>
        Done: ${data.done}<br>
        Missed: ${data.missed}<br>
        Cancelled: ${data.cancelled}
    `;
}

async function markMissed(id) {

    const { error } = await supabaseClient.rpc(
        "update_queue_status",
        {
            p_id: id,
            p_new_status: "missed"
        }
    );

    if (error) {
        console.error(error);
        return;
    }

    await loadQueue();
    await loadStats();
}

async function callSpecific(id) {

    const { data, error } = await supabaseClient.rpc(
        "force_call_ticket",
        {
            p_id: id
        }
    );

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    if (!data.success) {
        alert(data.message);
        return;
    }

    await loadQueue();
    await loadStats();
}