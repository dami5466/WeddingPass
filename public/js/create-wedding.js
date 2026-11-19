const form = document.getElementById("weddingForm");
const message = document.getElementById("message");
const button = document.getElementById("createButton");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.textContent = "";
    message.className = "";

    const weddingName = document.getElementById("weddingName").value.trim();
    const weddingDate = document.getElementById("weddingDate").value;
    const venue = document.getElementById("venue").value.trim();
    const template = document.getElementById("template").value;

    if (!weddingName) {
        message.textContent = "Please enter your wedding name.";
        message.className = "error";
        return;
    }

    button.disabled = true;
    button.textContent = "Saving your wedding...";

    try {
        const response = await fetch("/api/weddings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                weddingName,
                weddingDate,
                venue,
                template
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Could not save your wedding.");
        }

        message.textContent = "Your wedding has been saved successfully!";
        message.className = "success";

        setTimeout(() => {
            window.location.href = "/dashboard";
        }, 1200);

    } catch (error) {
        message.textContent = error.message;
        message.className = "error";
        button.disabled = false;
        button.textContent = "Save My Wedding";
    }
});
