function GET(assert, url, responseType, callback) {
	if(assert) var done = assert.async();
	var req = new XMLHttpRequest();
	req.open('GET', url);
	req.responseType = responseType;
	req.addEventListener('readystatechange', function() {
		if(req.readyState === 4) {
			if(req.status === 200) {
				callback(req.response);
				if(done) done();
			} else {
				throw 'Request failed: ' + req.status + ' ' + req.statusText;
			}
		}
	});
	req.send();
}

GET(null, 'cases-ls', 'text', function(response) {
	var ls = response.split('\n').filter(function(file) {
		return file;
	});
	
	QUnit.test('getHTML', function(assert) {
		var cases = ['../../res/empty.odt'].concat(ls.filter(function(file) {
			return file.split('.')[1] === 'odt';
		}));
		assert.expect(cases.length);
		cases.forEach(function(file) {
			GET(assert, 'cases/' + file, 'arraybuffer', function(response) {
				new ODTDocument(response).getHTML();
				assert.ok(true, file);
			});
		});
	});
	
	QUnit.test('setHTML', function(assert) {
		var cases = ls.filter(function(file) {
			return file.split('.')[1] === 'html';
		});
		assert.expect(cases.length);
		GET(assert, '../res/empty.odt', 'arraybuffer', function(empty) {
			cases.forEach(function(file) {
				GET(assert, 'cases/' + file, 'text', function(response) {
					var odtdoc = new ODTDocument(empty);
					odtdoc.setHTML(response);
					assert.ok(true, file);
				});
			});
		});
	});
});