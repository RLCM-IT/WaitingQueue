const supabaseUrl = "https://bkvvyissajffmhcdduof.supabase.co";
const supabaseKey = "sb_publishable_FVnD6MyrqCoOqsrO8yI71g_uP5zi-Bv";

const supabaseClient = supabase.createClient(
    supabaseUrl,
    supabaseKey
);

/*localStorage.setItem(
    "queue_ticket_id",
    queueEntryId
);*/

function getDeviceId() {
    let deviceId = localStorage.getItem("queue_device_id");

    if(!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("queue_device_id", deviceId);
    }

    return deviceId;
}

/*async function  getQueueState() {
    const { data: settings} =
        await supabaseClient
            .from("queue_settings")
            .select("*")
            .single();

    const today = 
        new Date().toISOString().split("T")[0];

    const { count } = 
        await supabaseClient
            .from("queue_entries")
            .select ("*", { count: "excat", head: true })
            .eq("queue_date", today)

    if (count >= settings.max_people) {
        return "full";
    }

    if (count >= settings.almost_full_threshold) {
        return "almostFull";
    }

    return "hasAPlace";
}

async function  showState() {
    
    const state = await getQueueState();

    const div = document.getElementById("status");

    if (state === "full") {
        div.innerHTML = `
            <h2>Today's queue is full.</h2>
        `;

        return;
    }

    if (state === "full") {
        div.innerHTML = `
            <h2>Today's queue is full.</h2>
        `;

        return;
    }

    if (state === "almostFull") {
        div.innerHTML = `
            <h2>Queue almost full</h2>

            <p>
                There is a high likelihood
                that no appointment slot
                will become available today.
            </p>

            <button id="joinBtn">
                Join Queue
            </button>
        `;

        document.getElementById("joinBtn").addEventListener("click", joinQueue);

        return;
    }

    div.innerHTML = `
        <h2>Places available</h2>

        <button id="joinBtn">
            Join Queue
        </button>
    `;

    document
        .getElementById("joinBtn")
        .addEventListener("click", joinQueue);
}


async function joinQueue() {
    
    const existing = await getExistingTicket();

    if(existing) {

        showTicket(existing)

        return;
    }

    showForm();
}

function showForm() {
    document.getElementById("formContainer").style.display = "block";

    document.getElementById("submitForm").onclick = submitForm;
}

async function submitForm() {
    const firstname = document.getElementById("firstname").value;

    const lastname = document.getElementById("lastname").value;

    const email = document.getElementById("email").value;

    if (!firsname || !lastname || !email) {
        alert("Fill all fields");
        return;
    }

    const { data: last } = 
        await supabaseClient
            .from("queue_entries")
            .select("queue_number")
            .order("queue_number", {
                ascending: false
            }).limit(1);

    const nextNumber = last?.length ? last[0].queue_number + 1 : 1;

    const { data, error } =
        await supabaseClient
            .from("queue_entries")
            .insert({
                device_id: deviceId,
                queue_number: nextNumber,
                firstname,
                lastname,
                email
            }).select().single();

    if (error) {
        alert(error.message);
        return;
    }

    showTicket(data);
}

function generateTicketNumber() {
    return Math.floor(
        1000 + Math.random() * 9000
    ).toString();
}*/

async function submitForm() {

    const firstname =
        document.getElementById(
            "firstname"
        ).value;

    const lastname =
        document.getElementById(
            "lastname"
        ).value;

    const email =
        document.getElementById(
            "email"
        ).value;

    const { data, error } =
        await supabaseClient.rpc(
            "join_queue",
            {
                p_device_id: deviceId,
                p_firstname: firstname,
                p_lastname: lastname,
                p_email: email
            }
        );

    if (error) {

        alert(error.message);

        return;
    }

    if (!data.success) {

        alert(data.message);

        return;
    }

    localStorage.setItem(
        "queue_entry_id",
        data.entry_id
    );

    document
        .getElementById("status")
        .innerHTML = `
            <h2>Your Ticket</h2>
            <h1>${data.ticket}</h1>
        `;

    document
        .getElementById("formContainer")
        .style.display = "none";
}

async function checkExistingTicket() {

    const { data, error } =
        await supabaseClient.rpc(
            "get_my_ticket",
            {
                p_device_id: deviceId
            }
        );

    if (error) {
        console.error(error);
        return;
    }

    if (!data.found) {
        return;
    }

    showTicket(data);
}

function showTicket(ticket) {

    let statusText = "Waiting";

    if (ticket.status === "called") {
        statusText = "YOUR NUMBER IS BEING CALLED";
    }

    document
        .getElementById("status")
        .innerHTML = `
            <h2>Your Ticket</h2>

            <h1>${ticket.ticket}</h1>

            <p>
                Status:
                <strong>${statusText}</strong>
            </p>

            <p>
                Checked In:
                ${new Date(
                    ticket.checked_in_at
                ).toLocaleString()}
            </p>
        `;

    document
        .getElementById("formContainer")
        .style.display = "none";
}

function subscribeToUpdates() {

    supabaseClient
        .channel("queue_updates")
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "queue_entries",
                filter: `device_id=eq.${deviceId}`
            },
            (payload) => {

                const updated = payload.new;

                showTicket({
                    id: updated.id,
                    ticket: updated.ticket_number,
                    status: updated.status,
                    checked_in_at: updated.checked_in_at,
                    called_at: updated.called_at
                });
            }
        )
        .subscribe();
}

const deviceId = getDeviceId();

subscribeToUpdates();

document.getElementById("submitBtn").addEventListener("click", submitForm);

console.log("Device:", deviceId);

checkExistingTicket();

//showState();