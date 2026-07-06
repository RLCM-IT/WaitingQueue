const supabaseUrl = "https://bkvvyissajffmhcdduof.supabase.co";
const supabaseKey = "sb_publishable_FVnD6MyrqCoOqsrO8yI71g_uP5zi-Bv";
const deviceId = getDeviceId();

async function  getIP(){
    const ipRes =  await fetch("https://api.ipify.org?format=json");
    const ipData =  await ipRes.json();
    return ipData.ip;
}

const formSchema = [
    {
        key: "firstname",
        label: "First Name",
        type: "text",
        required: true
    },
    {
        key: "lastname",
        label: "Last Name",
        type: "text",
        required: true
    },
    {
        key: "email",
        label: "Email",
        type: "email",
        required: true
    }
];

const supabaseClient = supabase.createClient(
    supabaseUrl,
    supabaseKey
);

const UI_STATE = {
    STATUS: "status",
    GDPR: "gdpr",
    FORM: "form",
    TICKET: "ticket"
};

let currentUI = null;

document.addEventListener("DOMContentLoaded", async () => {
    resetUI();
    subscribeToUpdates();
    await initCustomer();
    //resetUI();
});

//document.getElementById("continueBtn").addEventListener("click", showForm);

function setUI(state) {

    const status = document.getElementById("status");
    const gdpr = document.getElementById("gdprBox");
    const form = document.getElementById("formContainer");
    const ticket = document.getElementById("ticket");
    const card = document.getElementById("card")

    if (!status || !gdpr || !form || !ticket || !card) {
        console.error("Missing UI elements in HTML");
        return;
    }

    status.style.display = state === "status" ? "block" : "none";
    gdpr.style.display = state == "gdpr" ? "block" : "none";
    form.style.display = state === "form" ? "block" : "none";

    if(state === "ticket") {
        card.style.display = "none";
        ticket.style.display = "block";
    } else {
        card.style.display = "block"; 
        ticket.style.display = "none";
    }
}

function renderJoinUI(text, warning = false) {

    const div = document.getElementById("status");

    div.innerHTML = `
        <h2>${warning ? "⚠️ " : ""}${text}</h2>

        <label style="display:block; margin:10px 0;">
            <input type="checkbox" id="gdpr">
            I agree to data processing (GDPR)
        </label>

        <button id="joinBtn">Continue</button>
    `;

    document.getElementById("joinBtn").onclick = () => {

        const gdpr = document.getElementById("gdpr")?.checked;

        if (!gdpr) {
            alert("You must accept GDPR");
            return;
        }

        showForm();
    };
}

async function showState() {

    const state = await getQueueState();

    const div = document.getElementById("status");

    let css = "";

    div.innerHTML = `
        <label>
            <input type="checkbox" id="gdpr">
            I agree to data processing
        </label>

        <button id="continueGdpr">Continue</button>
    `;

    console.log(state);

    if (state === "full") {
        setUI(UI_STATE.STATUS);

        css="status-full";

        div.innerHTML = `<h2 class="${css}">Unfortunately, we are no longer able to provide consultations today. Please keep the waiting area free. You may go to other consultation centers or try again with us next week.</h2>
            `;

        return;
    }
    if (state === "almostFull")
    {
        css="status-almost";
        div.innerHTML = `
        <h2 class="${css}">We are almost fully booked today. There is a possibility that you will not receive a consultation appointment today, even if you have a ticket.</h2>
        <button id="continueState">Continue</button>
    `;
    }
    else 
    {
        css="status-open";
        div.innerHTML = `
        <h2 class="${css}">Places Available</h2>
        <button id="continueState">Continue</button>
    `;
    }

    document.getElementById("continueState").onclick = () => {
        showGDPR();
    };
}

function getDeviceId() {
    let deviceId = localStorage.getItem("queue_device_id");

    if(!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("queue_device_id", deviceId);
    }

    return deviceId;
}

function openTicket(ticket) {

    showTicket(ticket);
    setUI(UI_STATE.TICKET);

}

async function getQueueState() {

    const gdpr = document.getElementById("gdpr");
    if (gdpr) gdpr.checked = false;

    const { data, error } = await supabaseClient.rpc("queue_state");

    if (error) {
        console.error(error);
        return "open";
    }

    return data.state;
}

async function submitForm() {

    const gdpr = document.getElementById("gdprCheckBox")?.checked;
    //const userIp = await getIP();

   if (!gdpr) {
        alert("You must accept GDPR");
        return;
    }

    //const formData = collectFormData();

   // if (!validateForm(formData))  return;

    const { data, error } = await supabaseClient.rpc("join_queue_simple", {
        p_device_id: deviceId,
        //p_firstname: formData.firstname,
        //p_lastname: formData.lastname,
        //p_email: formData.email,
       // p_ip: userIp
    });

    /*if (error || !data?.success) {
        alert(error?.message || data?.message);
        return;
    }*/

    //const ticket = await checkExistingTicket();
    openTicket(data);

    //resetUI();

    //await initCustomer();
}

async function checkExistingTicket() {

    const { data, error } =
        await supabaseClient.rpc("get_my_ticket", {
            p_device_id: deviceId
        });

    if (error || !data) return null;

    const ticket = Array.isArray(data) ? data[0] : data;

    if (!ticket) return null;

    if (["done", "cancelled", "missed"].includes(ticket.status)) {
        return null;
    }

    return ticket;
}

function showTicket(ticket) {

    let statusText = "Waiting";
    let statusClass = "status-waiting";

    if (ticket.status === "called") {
        statusText = "YOUR NUMBER IS BEING CALLED";
        statusClass = "status-called";
    }

    document
        .getElementById("ticket")
        .innerHTML = `
            <div class="ticket-card">

                <h2>Your Ticket</h2>

                <div class="ticket-number">
                    ${ticket.ticket_number}
                </div>

                <div class="ticket-status ${statusClass}">
                    ${statusText}
                </div>

                <div class="ticket-time">
                    Checked in:<br>
                    ${new Date(ticket.checked_in_at).toLocaleString()}
                </div>

            </div>
        `;

    /*document
        .getElementById("formContainer")
        .style.display = "none";*/
}

function subscribeToUpdates() {

    const channel = supabaseClient.channel("queue_updates");

    channel.on(
        "postgres_changes",
        {
            event: "*",
            schema: "public",
            table: "queue_entries",
            filter: `device_id=eq.${deviceId}`
        },
        (payload) => {

            handleRealtimeUpdate(payload);

            /*const updated = payload.new;

            if (!updated) return;

            if (["done", "cancelled", "missed"].includes(updated.status)) {

                document.getElementById("status").innerHTML = `
                    <h2>Your ticket is no longer active</h2>
                    <p>Status: ${updated.status}</p>
                `;

                setUI(UI_STATE.STATUS);

                return;
            }

            //initCustomer();
            showTicket(updated);
            setUI(UI_STATE.TICKET);*/
        }
    );

    channel.subscribe();
}

async function handleRealtimeUpdate(payload) {
    const updated = payload.new;
    if (!updated) return;

    if (["done", "cancelled", "missed"].includes(updated.status)) {
        setUI(UI_STATE.STATUS);

        document.getElementById("status").innerHTML = `
            <h2>Ticket closed</h2>
            <p>Status: ${updated.status}</p>
        `;

        return;
    }

    // IMPORTANT: always re-fetch instead of trusting payload
    const ticket = await checkExistingTicket();

    if (ticket) {
        openTicket(ticket);
    }
}

async function initCustomer() {

    const ticket = await checkExistingTicket();

    if (ticket) {

        // active ticket
        openTicket(ticket);
        return;
    }

    // no active ticket → always restart clean flow
    await showQueueStatus();
}

function showForm() {
    renderForm();
    setUI(UI_STATE.FORM);
}

async function showQueueStatus() {

    const state = await getQueueState();
    setUI(UI_STATE.STATUS);

    let text = "";

    if (state === "full") {
        text = "Fully booked today";
    } else if (state === "almostFull") {
        text = "Almost full — limited availability";
    } else {
        text = "Places available";
    }

    showState(text);
}

function resetUI() {

    const status = document.getElementById("status");
    const gdpr = document.getElementById("gdprBox");
    const form = document.getElementById("formContainer");
    const ticket = document.getElementById("ticket")

    if (status) status.style.display = "block";
    if (gdpr) gdpr.style.display = "none";
    if (form) form.style.display = "none";
    if (ticket) ticket.style.display = "none";
}

function showGDPR() {

    const div = document.getElementById("gdprBox");

    div.innerHTML = `
        <div class="gdpr-card">
            <h2>Data privacy</h2>
            <p>
                Please read our privacy policy before continuing.
            </p>

            <a href="gdpr.html" target="_blank">
                View GDPR document
            </a>

            <label class="gdpr-check">
                <input type="checkbox" id="gdprCheckBox">

                <span>
                    I agree to data processing.
                </span>
            </label>

            <button id="continueGdpr">Continue</button>
        </div>
    `;

    setUI(UI_STATE.GDPR);

    document.getElementById("continueGdpr").onclick = () => {

        const ok = document.getElementById("gdprCheckBox")?.checked;

        if (!ok) {
            alert("Please accept GDPR");
            return;
        }

        showForm();
    };
}

function renderForm() {
    const container = document.getElementById("form");

    container.innerHTML = "A place in the queue does not guarantee entitlement to a consultation!";

    /*formSchema.forEach(field => {
        const wrapper = document.createElement("div");
        wrapper.style.marginBottom = "12px";

        const label = document.createElement("label");
        label.innerText = field.label;

        const input = document.createElement("input");
        input.type = field.type;
        input.id = field.key;
        input.dataset.key = field.key;

        if (field.required) input.required = true;

        wrapper.appendChild(label);
        wrapper.appendChild(document.createElement("br"));
        wrapper.appendChild(input);

        container.appendChild(wrapper);
    });*/
}

function collectFormData() {
    const data = {};

    for (const field of formSchema) {
        const el = document.getElementById(field.key);

        if (!el) continue;

        data[field.key] = el.value.trim();
    }

    return data;
}

function validateForm(data) {
    for (const field of formSchema) {
        if (field.required && !data[field.key]) {
            alert(`${field.label} is required`);
            return false;
        }
    }

    return true;
}

document.getElementById("submitBtn").addEventListener("click", submitForm);

console.log("Device:", deviceId);