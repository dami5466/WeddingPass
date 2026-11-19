const weddingSelect = document.getElementById("weddingId");
const guestForm = document.getElementById("guestForm");
const guestList = document.getElementById("guestList");
const message = document.getElementById("message");
const addButton = document.getElementById("addGuestButton");

async function loadWeddings() {
    try {
        const response = await fetch("/api/weddings");

        if (!response.ok) {
            throw new Error("Could not load your weddings.");
        }

        const result = await response.json();

        weddingSelect.innerHTML = '<option value="">Choose a wedding</option>';

        result.weddings.forEach(wedding => {
            const option = document.createElement("option");
            option.value = wedding.id;
            option.textContent = wedding.wedding_name;
            weddingSelect.appendChild(option);
        });

        if (result.weddings.length > 0) {
            loadGuests();
        }

    } catch (error) {
        weddingSelect.innerHTML = '<option value="">Unable to load weddings</option>';
        message.textContent = error.message;
        message.className = "error";
    }
}

async function loadGuests() {
    const weddingId = weddingSelect.value;

    if (!weddingId) {
        guestList.innerHTML = '<p class="empty">Select a wedding to view its guests.</p>';
        return;
    }

    try {
        const response = await fetch(`/api/weddings/${weddingId}/guests`);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Could not load guests.");
        }

        guestList.innerHTML = "";

        if (result.guests.length === 0) {
            guestList.innerHTML = '<p class="empty">No guests added yet.</p>';
            return;
        }

        result.guests.forEach(guest => {
            const item = document.createElement("div");
            item.className = "guest";

            const name = document.createElement("h3");
            name.textContent = guest.guest_name;

            const category = document.createElement("p");
            category.textContent = "Category: " + guest.category;

            const phone = document.createElement("p");
            phone.textContent = "Phone: " + (guest.phone || "Not provided");

            const email = document.createElement("p");
            email.textContent = "Email: " + (guest.email || "Not provided");

            const status = document.createElement("p");
            status.textContent = "Invitation: " + guest.status;

            const qrLabel = document.createElement("p");
            qrLabel.textContent = "Guest QR Invitation:";

            const qrImage = document.createElement("img");
            qrImage.src = `/api/weddings/${weddingId}/guests/${guest.id}/qr`;
            qrImage.alt = "Guest QR Code";
            qrImage.width = 180;
            qrImage.style.display = "block";
            qrImage.style.margin = "12px 0";

            item.append(name, category, phone, email, status, qrLabel, qrImage);
            guestList.appendChild(item);
        });

    } catch (error) {
        guestList.textContent = error.message;
    }
}

weddingSelect.addEventListener("change", loadGuests);

guestForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.textContent = "";
    message.className = "";

    const weddingId = weddingSelect.value;

    if (!weddingId) {
        message.textContent = "Please select a wedding first.";
        message.className = "error";
        return;
    }

    const guest = {
        guestName: document.getElementById("guestName").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        email: document.getElementById("email").value.trim(),
        category: document.getElementById("category").value
    };

    if (!guest.guestName) {
        message.textContent = "Please enter the guest's name.";
        message.className = "error";
        return;
    }

    addButton.disabled = true;
    addButton.textContent = "Adding Guest...";

    try {
        const response = await fetch(`/api/weddings/${weddingId}/guests`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(guest)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Could not add guest.");
        }

        message.textContent = "Guest added successfully!";
        message.className = "success";

        guestForm.reset();
        weddingSelect.value = weddingId;

        await loadGuests();

    } catch (error) {
        message.textContent = error.message;
        message.className = "error";
    } finally {
        addButton.disabled = false;
        addButton.textContent = "Add Guest";
    }
});

loadWeddings();

