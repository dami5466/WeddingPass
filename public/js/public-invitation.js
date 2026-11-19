const loading = document.getElementById("loading");
const invitationContent = document.getElementById("invitationContent");
const errorContent = document.getElementById("errorContent");
const shareMessage = document.getElementById("shareMessage");

const slug = decodeURIComponent(
    window.location.pathname.split("/").filter(Boolean).pop() || ""
);

let invitationLink = window.location.href;
let weddingTitle = "Our Wedding Invitation";

function formatWeddingDate(value) {
    if (!value) return "Date to be announced";

    const parts = value.split("-").map(Number);

    if (parts.length !== 3 || parts.some(number => !Number.isInteger(number))) {
        return "Date to be announced";
    }

    const date = new Date(parts[0], parts[1] - 1, parts[2], 12);

    if (Number.isNaN(date.getTime())) return "Date to be announced";

    return date.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}

async function loadPublicInvitation() {
    try {
        const response = await fetch(
            `/api/public/invitations/${encodeURIComponent(slug)}`
        );

        const data = await response.json();

        if (!response.ok || !data.success || !data.wedding) {
            throw new Error("Invitation not found.");
        }

        const wedding = data.wedding;

        const bride = wedding.bride_name || "Bride";
        const groom = wedding.groom_name || "Groom";

        document.getElementById("coupleNames").textContent =
            `${bride} & ${groom}`;

        document.getElementById("invitationMessage").textContent =
            wedding.invitation_message ||
            "Together with our families, we invite you to celebrate our special day.";

        document.getElementById("weddingDate").textContent =
            formatWeddingDate(wedding.wedding_date);

        document.getElementById("weddingVenue").textContent =
            wedding.venue || "Venue to be announced";

        const card = document.getElementById("invitationCard");

        const themes = {
            "Luxury Gold & White": "theme-gold",
            "Royal Black & Gold": "theme-black",
            "Elegant White & Wine Red": "theme-wine",
            "Modern Colourful": "theme-colourful",
            "Custom": "theme-gold"
        };

        card.classList.add(themes[wedding.template] || "theme-gold");

        weddingTitle = `${bride} & ${groom} Wedding Invitation`;
        document.title = weddingTitle + " | WeddingPass";

        invitationLink = window.location.href;

        document.getElementById("invitationQR").src =
            `/api/public/invitations/${encodeURIComponent(slug)}/qr`;

        loading.hidden = true;
        invitationContent.hidden = false;

    } catch (error) {
        console.error("Public invitation error:", error);
        loading.hidden = true;
        errorContent.hidden = false;
    }
}

document.getElementById("whatsappButton").addEventListener("click", () => {
    const message =
        `You are invited! ❤️\n${weddingTitle}\nView the invitation here: ${invitationLink}`;

    window.open(
        `https://wa.me/?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
    );
});

document.getElementById("copyButton").addEventListener("click", async () => {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(invitationLink);
        } else {
            const temporaryInput = document.createElement("textarea");
            temporaryInput.value = invitationLink;
            temporaryInput.style.position = "absolute";
            temporaryInput.style.left = "-9999px";
            document.body.appendChild(temporaryInput);
            temporaryInput.select();

            const copied = document.execCommand("copy");
            temporaryInput.remove();

            if (!copied) throw new Error("Copy was unsuccessful.");
        }

        shareMessage.textContent = "✓ Invitation link copied successfully!";
    } catch (error) {
        shareMessage.textContent = "Please copy this link from your browser address bar.";
    }
});

loadPublicInvitation();
