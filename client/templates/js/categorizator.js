function showErrorMessage(message) {
    vscode.postMessage({
        command: 'showError',
        value: message
    });
}

/**
 * Создает элемент типа radio
 * 
 * @param {string} formId 
 * @param {string} optionId 
 * @param {string} value 
 */
function create_radio(formId, name, value) {
    var newRadio = $('<input>', {
        type: 'radio',
        name: name,
        value: value
    });

    var newLabel = $('<label>', {
        text: value
    });

    var newP = $('<p>');

    $('#' + formId).append(newRadio, newLabel, newP);
}

function create_checkbox(formId, name, value) {
    var newCheckbox = $('<input>', {
        type: 'checkbox',
        name: name,
        value: value
    });

    var newLabel = $('<label>', {
        text: value
    });

    var newP = $('<p>');

    $('#' + formId).append(newCheckbox, newLabel, newP);
}

/**
 * 
 * @param {string} formId 
 */
function clear_form(formId) {
	$('#' + formId).empty();
}

/**
 * Обновляет форму с вариантами отваета в соответствии с переданными значениями 
 * 
 * @param {string} formId 
 * @param {string} name 
 * @param {Array[string]} values 
 */
// BUG: Если нужно обновлять ответы под raws - добавить ветвление и функционал работы с checkbox 
function update_domains(formId, name, values)  {
	clear_form(formId);

    if (name != 'raws') {
        for (var i = 0; i < values.length; i++) {
            console.info(`Значение новой опции: ${values[i]}`);
            create_radio(formId, name, values[i]);
        }
    } else {
        for (var i = 0; i < values.length; i++) {
                console.info(`Значение новой опции: ${values[i]}`);
                create_checkbox(formId, name, values[i]);
            }
    }
}

/**
 * 
 * @param {string} areaId 
 * @param {string} value 
 */
function append_textarea(areaId, value) {
    var text = $('#' + areaId).val();
    if (text  ==  '') {
        text +=  value;
        console.log(text);
    } else if (value.includes('raws:')) {
        text = value + '\n' + text;
        console.log(text);
    } else {
        text += '\n' + value;
        console.log(text);
    }
    $('#' + areaId).val(text);
}

/**
 * 
 * @param {string} areaId 
 */
function clear_textarea(areaId) {
    $('#' + areaId).val('');
}

/**
 * 
 * @param {string} areaId 
 * @param {string} value 
 */
function change_textarea(areaId, value)  {
	$('#' + areaId).val(value);
}

function pop_line_from_textarea(areaId) {
    const textarea = $('#' + areaId);
    const text = textarea.val();
    // DELETE ME
    console.log(textarea + " : " + text)

    if (text.length > 0) {
        const lines = text.split('\n');
        var lastline = lines.pop(); // Удаление последней строки
        const newText = lines.join('\n');
        textarea.val(newText);
    }
    lastline = lastline.split(': ');
    const level = lastline[0];
    const domain = lastline[1];
    return { level, domain };
}

function shift_line_from_textarea(areaId) {
    const textarea = $('#' + areaId);
    const text = textarea.val();
    // TODO: DELETE ME
    console.log(textarea + " : " + text)

    if (text.length > 0) {
        const lines = text.split('\n');
        var firstline = lines.shift(); // Удаление первой строки
        const newText = lines.join('\n');
        textarea.val(newText);
    }
    firstline = firstline.split(': ');
    const level = firstline[0];
    const domain = firstline[1];
    return { level, domain };
}

function is_category_done(areaId)  {
    const textarea  =  $('#' + areaId);
    const text  = textarea.val();

    if (text.length  >  0)  {
        const lines = text.split('\n');
        var firstline = lines[0];

        if (firstline.includes('raws:')) {
            return true;
        }
    }
    return false;
}