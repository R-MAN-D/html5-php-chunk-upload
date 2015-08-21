/* @author  Armande Bayanes
 * @date    July 31, 2015
 * */

var chunker = {

    // This part of code is modifiable.
    config : {

        upload_trigger : 'upload',

        element_id : 'file',
        element_queue: 'queue',
        element_queue_item : 'li', // Used to wrap file data.

        multiple_upload : true,

        chunk_size : 512, // 512 B / 0.5 KB,
        limit : 10 // Up to 10 files to upload only.
    },

    /** Starting from this line, codes should NOT be MODIFIED. *********************************************************/
    queue : [],
    uploaded : 0, // Counter to finished uploaded files.
    filename : [],

    // Check if special functions are compatible to the current browser.
    compatibility : function() {

        if(typeof window.XMLHttpRequest === "undefined") {

            chunker.notice(0);
            return false;

        } else if(typeof Blob.prototype.slice === "undefined") {

            chunker.notice(1);
            return false;
        }

        return true;
    },

    // Note: This is a callback function so you cannot use "this" to point to "chunker".
    initialize : function() {

        if(! chunker.compatibility()) {

            // Don't go further.
            return;
        }

        if(! chunker.config.chunk_size) chunker.config.chunk_size = 1024; // If not set.
        if(! chunker.config.limit) chunker.config.limit = 10; // If not set.

        var element = document.getElementById(chunker.config.element_id);

        // Provide event to trigger when element is changed.
        element.addEventListener('change', chunker.html.input.change);

        // Enable multiple upload when set.
        if(chunker.config.multiple_upload) {
            element.setAttribute('multiple', 'multiple');
        }

        var upload = document.getElementById(chunker.config.upload_trigger);
        upload.addEventListener('click', chunker.upload);
        upload.addEventListener('mouseover', chunker.html.input.hover);

        document.getElementById('tip').innerHTML += ' And can upload up to '+ chunker.config.limit +' file(s) simultaneously.';
    },

    upload : function() {

        if(! chunker.queue.length) return;

        // Determines the size per chunk of the entire file.
        // Passed variable in the configuration is in KBytes so convert into Bytes.
        const chunk_size = 1024 * chunker.config.chunk_size;

        for(var x=0; x<chunker.queue.length; x++) {

            var file = chunker.queue[x];
            var start = 0, part = 1;
            var end = chunk_size;
            var chunks = Math.ceil(file.size / chunk_size);

            var data = new FormData();

            data.append('chunks', chunks); // Total chunks.
            data.append('index', x); // Indicate file index in the queue.
            data.append('filename', chunker.filename[x]); // Pass unique name.

            chunker.html.loader(x + 1);
            chunker.xhr.request(file, data, start, end, part, chunk_size, chunks);
        }
    },

    clear : function() {

        if(! chunker.queue.length) {

            chunker.notice(2, 'queue');
            return;
        }

        chunker.uploaded = 0;
        chunker.queue = [];
        chunker.filename = [];

        chunker.notice(2, 'queue');
    },

    html : {

        input : {

            // Callback function for input element.
            change : function(e) {

                var total = e.target.files.length, files = [], id = 0;

                chunker.clear();

                for(var b=0; b<total; b++) {

                    if(chunker.queue.length == chunker.config.limit) {

                        // Don't enqueue further when reached the limit of files to queue.
                        break; return;
                    }

                    var file = e.target.files[b];
                    var file_size_limit = false;

                    if(file.size > 5242880) { // 5MB limit per file size. Hard-coded in the purpose of non-modifiable.

                        file_size_limit = true;
                    } else {

                        chunker.queue.push(file);
                        chunker.filename.push((new Date).getTime() + b); // Unique identifier.
                        id++;
                    }

                    files.push(chunker.html.itemise('<b class="chunker-filename">'+ file.name +'</b> <span class="chunker-size">'+ file.size +' bytes</span> <span class="chunker-progress"></span>', ((file_size_limit) ? 0 : id), file_size_limit));
                }

                var queue = document.getElementById(chunker.config.element_queue);
                queue.innerHTML = files.join('');
            },

            hover : function() {

                // chunker.uploaded plays an important role here.
                if(chunker.queue.length && chunker.uploaded != chunker.queue.length) return;

                chunker.clear();
            }
        },

        loader : function(index, progress) {

            var item = document.getElementById('chunker-item-'+ index);
            var tag = chunker.html.queue.tag(item);

            if(typeof progress === 'undefined') {
                progress = '0'
            }

            // Calculate and display progress.
            tag.innerHTML = progress +'% <img id="loader_'+ index +'" src="assets/img/ajax-loader.gif" alt="uploading ..." />';

            return item;
        },

        queue : {

            progress : function(data) {

                if(typeof data === 'undefined') return; // Ensure that data is present.
                eval('var data = '+ data); // Parse return data into JSON.

                var index = data.index + 1;
                var part = data.part;
                var total = data.total;

                var item = chunker.html.loader(index, Math.ceil((part / total) * 100));

                if(part == total) {

                    chunker.uploaded++;
                    delete chunker.queue[index];

                    // Finished uploading.
                    item.style.textDecoration = 'line-through';
                    item.style.fontStyle = 'italic';
                    item.style.color = '#777';

                    var loader = document.getElementById('loader_'+ index);
                    loader.parentNode.removeChild(loader); // Deletes self.
                }
            },

            // Find the tag where to put progress.
            tag : function(item) { // "item" as 'parent'.

                var tag = null;
                for(var b in item.childNodes) {

                    if(item.childNodes[b].className && item.childNodes[b].className == 'chunker-progress') {

                        tag = item.childNodes[b];
                        break;
                    }
                }

                return tag;
            }
        },

        itemise : function(content, id, file_size_limit) {

            var id_attr = '';
            var number = 'Size limit exceeded: ';
            if(id > 0) {

                id_attr = ' id="chunker-item-'+ id +'"';
                number = id +'. ';
            }

            if(file_size_limit) file_size_limit = ' style="color: #FF0000"';
            else file_size_limit = '';

            return '<'+ chunker.config.element_queue_item + id_attr + file_size_limit +'>'+ number + content +'</'+ chunker.config.element_queue_item +'>';
        }
    },

    xhr : {

        // This solves freezing of other browsers and without sending back progress statistics.
        request : function(file, data, start, end, part, chunk_size, total) {

            data.append('part', part); // Pass part.

            /* To be able for server-side (PHP) to retrieve data via $_FILES['file'],
             and with the specific filename included - without this will just give "blob" as name for all files.
             */

            //data.append('timestamp', (new Date).getTime());
            data.append('file', file.slice(start, end), file.name);

            // Send chunk.
            // Append time in milliseconds, this will keep the request fresh.
            chunker.xhr.send('upload.php?t='+ (new Date).getTime(), 'POST', data,

                function() { // Callback.

                    if(this.readyState == 4) { // OnLoad / Complete.

                        if(typeof this.status !== 'undefined') {

                            if(this.status == 200 && this.responseText) { // Proceed the loop while OK / success.

                                // Track progress for each chunk.
                                chunker.html.queue.progress(this.responseText);

                                if(part < total) {

                                    start = end;
                                    end = start + chunk_size;
                                    part++; // Indication of which part of chunk.

                                    chunker.xhr.request(file, data, start, end, part, chunk_size, total);
                                }

                            // Else, handle errors such as "500 Internal Server Error" here ...
                            } else {

                                // Re-send request on any error.
                                chunker.xhr.request(file, data, start, end, part, chunk_size, total);
                            }
                        }
                    }
                }
            );
        },

        send : function(url, method, data, callback) {

            var request = new XMLHttpRequest();

            if(callback) request.onreadystatechange = callback;

            request.open(method, url, true); // Asynchronous = TRUE.
            request.send(data);
        }
    },

    notice : function(type, container) {

        var message = ' Chunker library cannot work.<br />Please use FireFox or Chrome for this beautiful library to work while we work hard to support your browser soon.';

        if(type == 0) message = '<b>XMLHttpRequest</b> was not able to initialize!'+ message;
        else if(type == 1) message = '<b>Blob.prototype.slice</b> was not able to initialize!'+ message;
        else if(type == 2) message = 'Queue is empty. Browse files from your computer.';

        if(! container) container = 'chunker-buttons';
        document.getElementById(container).innerHTML = message;
    }
};

window.onload = chunker.initialize;