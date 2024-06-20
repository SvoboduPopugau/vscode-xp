function showErrorMessage(message) {
    vscode.postMessage({
        command: 'showError',
        value: message
    });
}

/**
 * Создает элемент 
 * 
 * @param {string} formId 
 * @param {string} optionId 
 * @param {string} value 
 */
function create_option(formId, name, value) {
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
function update_options(formId, name, values)  {
	clear_form(formId);

	for (var i = 0; i < values.length; i++) {
		console.log(`Значение новой опции: ${values[i]}`);
		create_option(formId, name, values[i]);
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

    if (text.length > 0) {
        const lines = text.split('\n');
        var lastline = lines.pop(); // Удаление последней строки
        const newText = lines.join('\n');
        textarea.val(newText);
    }
    lastline = lastline.split(': ');
    const domain = lastline[0];
    const value = lastline[1];
    return { domain, value };
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