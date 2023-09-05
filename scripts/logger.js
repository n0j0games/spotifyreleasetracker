const error_popup = {
    item : document.getElementById("error"),
    title : document.getElementById("errorTitle"),
    subtitle : document.getElementById("errorSubtitle"),
};

/* Show messages */
function log(title, subtitle) {
    message(title, subtitle, "#777777")
}

/* Show error */
function error(title, subtitle) {
    message(`Something went wrong: Error ${title} (Try reload page)`, subtitle, "#E43B44")
}

window.close_popup = function () {
    error_popup.item.style.display = "none";
}

function message(title, subtitle, color=null) {
    if (color !== null) {
        error_popup.item.style.background = color;
    }
    error_popup.item.style.display = "flex";
    error_popup.title.innerHTML = title
    error_popup.subtitle.innerHTML = subtitle;
}

export default {log, error, close_popup}