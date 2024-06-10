/**
 * 
 * @param {string} formId 
 * @param {string} optionId 
 * @param {string} value 
 */
function create_option(formId, optionId, value) {
	var form = document.getElementById(formId);

	var newRadio = document.createElement("input");
	newRadio.type = "radio";
	newRadio.name = "option";
	newRadio.id = optionId;
	newRadio.value = value;

	var newLabel = document.createElement("label");
    newLabel.htmlFor = optionId;
    newLabel.innerText = value;

	form.appendChild(newRadio);
	form.appendChild(newLabel);
    form.appendChild(document.createElement("p"));
}

/**
 * 
 * @param {string} formId 
 */
function clear_form(formId) {
	var form  = document.getElementById(formId);
	form.reset();
}

/**
 * 
 * @param {string} formId 
 * @param {Array[string]} values 
 */
function update_options(formId, values) {
	clear_form(formId);
	for(var i=0; i<values.length; i++)  {
		create_option(formId, "option"+i,  values[i]);
	}
}