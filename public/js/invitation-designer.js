const weddingSelect = document.getElementById("weddingId");
const brideInput = document.getElementById("brideName");
const groomInput = document.getElementById("groomName");
const dateInput = document.getElementById("weddingDate");
const venueInput = document.getElementById("venue");
const invitationInput = document.getElementById("invitationMessage");
const templateInput = document.getElementById("template");
const saveButton = document.getElementById("saveButton");
const messageBox = document.getElementById("message");
const preview = document.getElementById("invitationPreview");

let currentWeddingId = null;

function updatePreview() {
    const bride = brideInput.value.trim() || "Bride";
    const groom = groomInput.value.trim() || "Groom";

    document.getElementById("previewCouple").textContent =
        `${bride} & ${groom}`;

    document.getElementById("previewMessage").textContent =
        invitationInput.value.trim() ||
        "Together with our families, we invite you to celebrate our special day.";

    document.getElementById("previewDate").textContent =
        dateInput.value
            ? new Date(dateInput.value + "T12:00:00").toLocaleDateString(
                undefined,
                { weekday: "long", year: "numeric", month: "long", day: "numeric" }
              )
            : "Wedding Date";

    document.getElementById("previewVenue").textContent =
        venueInput.value.trim() || "Wedding Venue";

    preview.classList.remove(
        "theme-gold",
        "theme-black",
        "theme-wine",
        "theme-colourful"
    );

    const themes = {
        "Luxury Gold & White": "theme-gold",
        "Royal Black & Gold": "theme-black",
        "Elegant White & Wine Red": "theme-wine",
        "Modern Colourful": "theme-colourful",
        "Custom": "theme-gold"
    };

    preview.classList.add(themes[templateInput.value] || "theme-gold");
}

[
    brideInput,
    groomInput,
    dateInput,
    venueInput,
    invitationInput,
    templateInput
].forEach(element => {
    element.addEventListener("input", updatePreview);
    element.addEventListener("change", updatePreview);
});

async function loadWeddings() {
    try {
        const response = await fetch("/api/weddings");
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load your weddings.");
        }

        weddingSelect.innerHTML = "";

        if (!data.weddings.length) {
            weddingSelect.innerHTML =
                '<option value="">Create a wedding first</option>';
            messageBox.textContent = "You need to create a wedding before designing an invitation.";
            return;
        }

        data.weddings.forEach(wedding => {
            const option = document.createElement("option");
            option.value = wedding.id;
            option.textContent = wedding.wedding_name;
            weddingSelect.appendChild(option);
        });

        await loadInvitation(weddingSelect.value);

    } catch (error) {
        messageBox.textContent = error.message;
    }
}

async function loadInvitation(weddingId) {
    if (!weddingId) return;

    currentWeddingId = weddingId;
    messageBox.textContent = "Loading wedding details...";

    try {
        const response = await fetch(
            `/api/weddings/${encodeURIComponent(weddingId)}/invitation`
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not load invitation.");
        }

        const wedding = data.wedding;

        brideInput.value = wedding.bride_name || "";
        groomInput.value = wedding.groom_name || "";
        dateInput.value = wedding.wedding_date || "";
        venueInput.value = wedding.venue || "";
        invitationInput.value = wedding.invitation_message || "";
        templateInput.value = wedding.template || "Luxury Gold & White";

        updatePreview();
        messageBox.textContent = "Wedding details loaded.";

    } catch (error) {
        messageBox.textContent = error.message;
    }
}

weddingSelect.addEventListener("change", () => {
    loadInvitation(weddingSelect.value);
});

saveButton.addEventListener("click", async () => {
    if (!currentWeddingId) {
        messageBox.textContent = "Please select a wedding first.";
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
    messageBox.textContent = "";

    try {
        const response = await fetch(
            `/api/weddings/${encodeURIComponent(currentWeddingId)}/invitation`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    brideName: brideInput.value.trim(),
                    groomName: groomInput.value.trim(),
                    weddingDate: dateInput.value,
                    venue: venueInput.value.trim(),
                    invitationMessage: invitationInput.value.trim(),
                    template: templateInput.value
                })
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not save invitation.");
        }

        messageBox.textContent = "✓ Invitation design saved successfully!";
        messageBox.style.color = "#32834a";

    } catch (error) {
        messageBox.textContent = error.message;
        messageBox.style.color = "#b42318";
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save Invitation Design";
    }
});

updatePreview();
loadWeddings();
