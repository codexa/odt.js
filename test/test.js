QUnit.asyncTest('getHTML', function(assert) {
	var req = new XMLHttpRequest();
	req.open('GET', 'odt2html-ls');
	req.addEventListener('readystatechange', function() {
		if(req.readyState === 4) {
			if(req.status === 200) {
				var ls = req.responseText.split('\n').filter(function(file) {
					return file;
				});
				var todo = ls.length;
				assert.expect(todo);
				ls.forEach(function(file) {
					var req = new XMLHttpRequest();
					req.open('GET', 'odt2html/' + file);
					req.responseType = 'arraybuffer';
					req.addEventListener('readystatechange', function() {
						if(req.readyState === 4) {
							if(req.status === 200) {
								new ODTDocument(req.response).getHTML();
								assert.ok(true, file);
								if(!--todo) QUnit.start();
							} else {
								throw 'Request failed: ' + req.status + ' ' + req.statusText;
							}
						}
					});
					req.send();
				});
			} else {
				throw 'Request failed: ' + req.status + ' ' + req.statusText;
			}
		}
	});
	req.send();
});