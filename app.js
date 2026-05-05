let allData = []

let isAdmin = false

const supabaseUrl = 'https://bkvvyissajffmhcdduof.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrdnZ5aXNzYWpmZm1oY2RkdW9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5ODQ3NTcsImV4cCI6MjA5MzU2MDc1N30.RMNTBpK7npel8Tgr7eHY7zufjn7QDKaQIISyEBCO71c'

const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const loginDiv = document.getElementById('loginDiv')
const appDiv = document.getElementById('appDiv')

const emailInput = document.getElementById('email')
const passwordInput = document.getElementById('password')

const loginBtn = document.getElementById('loginBtn')
const logoutBtn = document.getElementById('logoutBtn')
const addBtn = document.getElementById('addBtn')

const searchInput = document.getElementById('search')
const list = document.getElementById('dataList')



loginBtn.addEventListener('click', async () => {
    const email = emailInput.value
    const password = passwordInput.value

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    })

    if (error) {
        console.error("Login error:", error)
        alert(error.message)
        return
    }
    await updateUI()
})



logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut()
    await updateUI()
    })



    async function loadData() {
    const { data, error } = await supabaseClient
        .from('translatorList')
        .select('*')

    if (error) {
        console.error("Data error:", error)
        return
    }

    allData = data
    renderList(allData)
}


addBtn.addEventListener('click', async () => {
    const name = prompt("Name?")
    const lastname = prompt("Lastname?")
    const mail = prompt("Mail?").toLowerCase()
    const languageInput = prompt("Languages (comma separated, e.g. deutsch, englisch")

    if(!name || !lastname || !mail) return

    const languages = languageInput
        ? languageInput.split(',').map(l =>
            l.trim().toLowerCase()
        )
    :[]


    const { error } = await supabaseClient
        .from('translatorList')
        .insert([{ name, lastname, mail, languages }])

    if (error) {
        alert(error.message)
        return
    }

    await loadData()
})


async function renderList(data) {
list.innerHTML = ''

data.forEach((item) => {
    const li = document.createElement('li')

    const text = document.createElement('span')
    text.textContent = `${item.name} 
                        ${item.lastname} - 
                        ${item.mail} - 
                        ${formatLanguages(item.languages)} `

    const editBtn = document.createElement('button')
    editBtn.textContent = "Edit"
    editBtn.addEventListener("click", () => {
        editRow(item.id)
    })

    const delBtn = document.createElement('button')
    delBtn.textContent = "Delete"
    delBtn.addEventListener("click", () => {
        deleteRow(item.id)
    })


    
    li.appendChild(text)
    li.appendChild(editBtn)
    li.appendChild(delBtn)

    list.appendChild(li)
})
}

async function editRow(id) {
    const name = prompt("New name?")
    const lastname = prompt("New lastname?")
    const mail = prompt("New mail?")
    const languageInput = prompt("Languages (comma separated, e.g. deutsch, englisch")

    if(!name || !lastname || !mail) return

    const languages = languageInput
        ? languageInput.split(',').map(l =>
            l.trim().toLowerCase()
        )
    :[]

    const { error } = await supabaseClient
        .from("translatorList")
        .update({ name, lastname, mail, languages})
        .eq('id', id)

    if (error) {
        alert(error.message)
        return
    }

    await loadData()
}


async function deleteRow(id) {
    if(!confirm("Delet entry?")) return

    const { error } = await supabaseClient
        .from("translatorList")
        .delete()
        .eq('id', id)

    if (error) {
        alert(error.message)
        return
    }

    await loadData()
}




searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase()

    const filtered = allData.filter(item => {
        return (
        item.name?.toLowerCase().includes(query) ||
        item.lastname?.toLowerCase().includes(query) ||
        item.mail?.toLowerCase().includes(query) ||
        item.languages?.join(', ').toLowerCase().includes(query)
        )
    })

    renderList(filtered)
})



async function updateUI(){
    const { data: { session } } = await supabaseClient.auth.getSession()

    isAdmin = true

    if(session) {
        //isAdmin = session.user.user_metadata?.role === "admin"

        loginDiv.style.display = "none"
        appDiv.style.display = "block"

        updateAdminUI()
        await loadData()
    } else {
        loginDiv.style.display = "block"
        appDiv.style.display = "none"
        list.innerHTML = ""
        allData = []
    }
}



function updateAdminUI() {
    addBtn.style.display = isAdmin ? 'block' : 'none'
}



const formatLanguages = (arr) =>
    arr?.map(l =>
        l.charAt(0).toUpperCase() + l.slice(1).toLowerCase()
    ).join(', ')



supabaseClient.auth.onAuthStateChange(() => {
updateUI()
})

updateUI()