//==============Variables========================================================

let searchTimeout

const AVAILABLE_LANGUAGES = [
    "deutsch",
    "englisch",
    "spanisch",
    "französisch",
    "italienisch"
]

const supabaseUrl = 'https://bkvvyissajffmhcdduof.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdnZ5aXNzYWpmZm1oY2RkdW9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5ODQ3NTcsImV4cCI6MjA5MzU2MDc1N30.RMNTBpK7npel8Tgr7eHY7zufjn7QDKaQIISyEBCO71c'

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const loginDiv = document.getElementById('loginDiv')
const appDiv = document.getElementById('appDiv')
const addFormDiv = document.getElementById("addForm")

const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')

const loginBtn = document.getElementById('loginBtn')
const logoutBtn = document.getElementById('logoutBtn')
const addBtn = document.getElementById('addBtn')

const searchInput = document.getElementById('search')
const list = document.getElementById('dataList')

//====== State Section ==========================================================

const state = {
    allData: [],
    search: "",
    isLoading: false,
    editingId: null,
    isAdmin: false
}

function setState(partial) {
    Object.assign(state, partial)
    render()
}

//===========Init================================================================
async function init() {
    const savedSearch = localStorage.getItem("search") || ""

    searchInput.value = savedSearch

    setState({
        search: savedSearch
    })

    await updateUI()
}

const formatLanguages = (arr) =>
    arr?.map(l =>
        l.charAt(0).toUpperCase() + l.slice(1).toLowerCase()
    ).join(', ')

supabaseClient.auth.onAuthStateChange(() => {
updateUI()
})

//===========Controller===========================================================

loginBtn.addEventListener('click', async () => {
    const email = emailInput.value
    const password = passwordInput.value

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    })

    if (error) {
        showToast(error.message, "error")
        return
    }
    await updateUI()
})

logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut()
    await updateUI()
})

addBtn.addEventListener('click', async () => {
    addFormDiv.style.display="block"
})

searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout)
    
    searchTimeout = setTimeout(() => {
        const value = searchInput.value

        localStorage.setItem("search", value)

        setState({
            search: value
        })
    }, 200)
})

async function updateUI(){
    const { data: { session } } = await supabaseClient.auth.getSession()

    if(session) {
        state.isAdmin = await getUserRole(session.user.id)

        loginDiv.style.display = "none"
        appDiv.style.display = "block"
        addFormDiv.style.display = "none"

        updateAdminUI()
        await loadData()
        renderAddLanguages()
    } else {
        loginDiv.style.display = "block"
        appDiv.style.display = "none"
        addFormDiv.style.display = "none"
        list.innerHTML = ""
        setState({ allData: []})
    }    
}

function updateAdminUI() {
    addBtn.style.display = state.isAdmin ? 'block' : 'none'
}

//=====supabase/api functions=================================================

async function loadData() {
    setState({
        isLoading: true
    })

    const { data, error } = await supabaseClient
        .from('translatorList')
        .select('*')

    if (error) {
        console.error("Data error:", error)
        showToast(error.message, "error")
        setState({isLoading: false})
        return
    }

    setState({
        allData: data,
        isLoading: false
    })
}

async function addRow() {
    const name = document.getElementById("add-name").value
    const lastname = document.getElementById("add-lastname").value
    const mail = document.getElementById("add-mail").value

    const container = document.getElementById("add-languages")

    const languages = Array.from(
        container.querySelectorAll("input[type='checkbox']:checked")
    ).map(cb => cb.value.toLowerCase())

    if( !name || !lastname || !mail || languages.length === 0){
        showToast("Please fill all fields", "error")
        return
    }

    const { data, error } = await supabaseClient
        .from("translatorList")
        .insert([{ name, lastname, mail, languages }])
        .select()
        .single()

    if (error) {
        showToast(error.message, "error")
        return
    }
    
    document.getElementById("add-name").value = ""
    document.getElementById("add-lastname").value = ""
    document.getElementById("add-mail").value = ""

    container.querySelectorAll("input").forEach(cb => cb.checked = false)

    addFormDiv.style.display = "none"
    
    setState({
        allData: [...state.allData, data]
    })

    showToast("Added successfuly", "success")
}

async function saveEdit(id) {
    const name = document.getElementById(`name-${id}`).value
    const lastname = document.getElementById(`lastname-${id}`).value
    const mail = document.getElementById(`mail-${id}`).value.toLowerCase()

    const languageInput = document.getElementById(`language-${id}`)

    const languages = Array.from(languageInput.querySelectorAll("input[type='checkbox']:checked"))
        .map(opt => opt.value.toLowerCase())

    if (!name || !lastname || !mail || languages.length === 0) {
        showToast("All fields are required", "error")
        return
    }

    if (!mail.includes("@")) {
        showToast("Invalid email", "error")
        return
    }

    const { data, error } = await supabaseClient
        .from("translatorList")
        .update({ name, lastname, mail, languages})
        .eq('id', id)
        .select()
        .single()

    if (error) {
        
        showToast("error.message", "error")
        return
    }

    setState({
        allData: state.allData.map(item => 
            item.id === id ? data : item
        ),
        editingId: null
    })

    showToast("Changes saved", "success")
}

async function deleteRow(id) {
    if(!confirm("Delet entry?")) return

    const { error } = await supabaseClient
        .from("translatorList")
        .delete()
        .eq('id', id)

    if (error) {
        showToast(error.message, "error")
        return
    }

    setState({
        allData: state.allData.filter(item => item.id !== id)
    })

    showToast("Entry deleted", "success")
}

async function  getUserRole(userId) {
    const { data, error } = await supabaseClient
        .from("user_rolls")
        .select("role")
        .eq("id", userId)
        .single()

    return data?.role === 'admin'
}

function getFilteredData() {
    const query = state.search.toLowerCase().trim()

    if (!query) return state.allData

    return state.allData.filter(item => {
        return (
            item.name?.toLowerCase().includes(query) ||
            item.lastname?.toLowerCase().includes(query) ||
            item.mail?.toLowerCase().includes(query) ||
            item.languages?.join(', ').toLowerCase().includes(query)
        )
    })
}

//=====DOM/UI functions====================================================

function render() {
    renderList(
        getFilteredData(),
        state.search.trim().length > 0
    )
}

function renderList(data = state.allData, isSearch = false) {
    list.innerHTML = ''

    if (state.isLoading) {
        list.innerHTML = `<p class="state-msg">Loading...</p>`
        return
    }

    if (!data || data.length === 0) {
        const msg = isSearch
            ? "No entries found for your search" 
            : "No entries found"
        
        const p = document.createElement('p')
        p.className = 'state-msg'
        p.textContent = msg

        list.appendChild(p)
        return
    }

    data.forEach((item) => {
        const li = document.createElement('li')
        
        if (state.editingId === item.id) {
            renderEditRow(li, item)
        } else {
            renderViewRow(li, item)
        }

        list.appendChild(li)
    })
}

function renderViewRow(li, item) {
    const info = document.createElement("div")

    const languages = item.languages
        ? item.languages.map(l =>
            l.charAt(0).toUpperCase() + l.slice(1)
        ).join(", "):""

    info.innerHTML = `
        <b>${item.name} ${item.lastname}</b><br>
        ${item.mail}<br>
        <i>${languages}</i>`

    li.appendChild(info)

    if (state.isAdmin) {
        const actions = document.createElement("div")
        
        const editBtn = document.createElement('button')
        editBtn.textContent = "Edit"
        
        editBtn.addEventListener("click", () => {
            setState({
                editingId: item.id
            })
        })

        const delBtn = document.createElement('button')
        delBtn.textContent = "Delete"

        delBtn.addEventListener("click", () => {
            deleteRow(item.id)
        })
    
        actions.appendChild(editBtn)
        actions.appendChild(delBtn)

        li.appendChild(actions)
    }
}

function renderEditRow(li, item) {
    const form = document.createElement("div")

    const selectedLangs = Array.isArray(item.languages) ? item.languages : []

    const languageOptions = AVAILABLE_LANGUAGES.map(lang => {
        const checked = selectedLangs.includes(lang.toLowerCase()) ? "checked" : ""
        return `<label class="lang-item"><input type="checkbox" value="${lang}" ${checked}>
            ${lang.charAt(0).toUpperCase() + lang.slice(1)}
        </label>`
    }).join("")

    form.innerHTML = `
        <input id="name-${item.id}" value="${item.name}">
        <input id="lastname-${item.id}" value="${item.lastname}">
        <input id="mail-${item.id}" value="${item.mail}">

        <div id="language-${item.id}" class="lang-container">${languageOptions}</div>
    `
    li.appendChild(form)

    const actions = document.createElement("div")

    const saveBtn = document.createElement("button")
    saveBtn.textContent = "Save"

    saveBtn.addEventListener("click", () => saveEdit(item.id))

    const cancelBtn = document.createElement("button")
    cancelBtn.textContent = "Cancel"

    cancelBtn.addEventListener("click", () => {
        setState({
            editingId: null
        })

        render()
    })
    
    actions.appendChild(saveBtn)
    actions.appendChild(cancelBtn)

    li.appendChild(actions)

    setTimeout(() => {
        document.getElementById(`name-${item.id}`)?.focus()
    }, 0)

    attachKeyboardHandlers(item)
}

function renderAddLanguages () {
    const container = document.getElementById("add-languages")

    if (!container) return

    container.innerHTML = AVAILABLE_LANGUAGES.map(lang => `
        <label class="lang-item">
            <input type="checkbox" value="${lang}">
            ${lang.charAt(0).toUpperCase() + lang.slice(1)}
        </label>`
    ).join("")
}

function showToast(message, type = "success") {
    const container = document.getElementById("toast-container")

    if (container.children.length > 3) {
        container.firstChild.remove()
    }

    const toast = document.createElement("div")
    toast.className = `toast ${type}`
    toast.textContent = message

    toast.addEventListener('click', () => toast.remove())

    container.appendChild(toast)

    setTimeout(() => {
        toast.classList.add("show")
    }, 10)

    setTimeout(() => {
        toast.classList.remove("show")
        
        setTimeout(() => {
            toast.remove()
        }, 300)
    }, 3000)
}

async function cancelAddRow() {
    const container = document.getElementById("add-languages")

    const languages = Array.from(
        container.querySelectorAll("input[type='checkbox']:checked")
    ).map(cb => cb.value.toLowerCase())

    document.getElementById("add-name").value = ""
    document.getElementById("add-lastname").value = ""
    document.getElementById("add-mail").value = ""

    container.querySelectorAll("input").forEach(cb => cb.checked = false)

    addFormDiv.style.display = "none"
}

function attachKeyboardHandlers(item) {
    const inputs = [
        `name-${item.id}`,
        `lastname-${item.id}`,
        `mail-${item.id}`,
        `language-${item.id}`
    ]

    inputs.forEach(id => {
        const el = document.getElementById(id)

        el?.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                saveEdit(item.id)
            }

            if (e.key === "Escape") {
                setState({
                    editingId: null
                })
            }
        })
    })
}

//=====Initialize Call==========================

document.addEventListener("DOMContentLoaded", init)