const vscode = acquireVsCodeApi();

document.getElementById('option1').addEventListener('change', function() {
	document.getElementById('dynamicTextSection').innerText = 'Вы выбрали вариант 1';
	vscode.postMessage({command: 'option1'});
	document.getElementById('dynamicTextSection').innerText = 'Вы выбрали вариант 1))))';
})		
document.getElementById('option2').addEventListener('change', function() {
	document.getElementById('dynamicTextSection').innerText = 'Вы выбрали вариант 2';
})		
document.getElementById('option3').addEventListener('change', function() {
	document.getElementById('dynamicTextSection').innerText = 'Вы выбрали вариант 3';
});