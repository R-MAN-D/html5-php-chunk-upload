<?php
/* @author  Armande Bayanes
 * @date    July 31, 2015
 * */

// HTTP Headers to tell no caching this page.
header( "Expires: Thu, 23 Aug 1984 08:00:00 GMT" );
header( "Last-Modified: " . gmdate( "D, d M Y H:i:s" ) . " GMT" );
header( "Cache-Control: no-store, no-cache, must-revalidate" );
header( "Cache-Control: post-check=0, pre-check=0", false );
header( "Pragma: no-cache" );

// Support CORS
header( "Access-Control-Allow-Origin: *" );

ob_start(); // Starts output buffering. Don't output anything yet.

@set_time_limit( 3600 ); // Script execution time.

$dir = 'uploads/';

// Make folder writable.
if( ! is_writable( $dir ) ) {

    $om = umask(0);
    @chmod( $dir, 0777 );
    umask( $om );
}

if( isset( $_FILES['file'] ) && isset( $_POST ) ) {

    $part = isset( $_POST['part'] ) ? ( (int) $_POST['part'] ) : 0;
    $chunks = isset( $_POST['chunks'] ) ? ( (int) $_POST['chunks'] ) : 0;

    if( $part && $chunks ) {

        // Get file extension from original file.
        $file = pathinfo( $_FILES['file']['name'] );

        // Generate new filename from passed variable.
        $filename = $_POST['filename'] . ' [' . $file['filename'] . ']' . '.' . $file['extension'];

        // Opens the destination file and determine whether writing new or appending next chunks / parts of the source file.
        $destination = @fopen( $dir . $filename, ( $part == 1 ) ? "wb" : "ab" );

        if( $part <= $chunks ) { // While part is not equal the total chunks.

            $source = @fopen( $_FILES['file']['tmp_name'], "rb" ); // Source.

            if( $source && $destination ) {

                // Read and write to destination until no content left from the source.
                while( $buffer = fread( $source, 4096 ) )
                    fwrite( $destination, $buffer );

                fclose( $source );
            }
        }

        fclose( $destination );

        // Return a formatted response to track progress of file in JavaScript (Client-Side).
        $output = '{"index" : ' . (int) $_POST['index'] . ', "part" : ' . $part . ', "total" : ' . $chunks . '}';

    } else {

        // Error responses.
        if( ! $part ) $output = '{"error" : "File part is missing."}';
        elseif( ! $chunks ) $output = '{"error" : "Total chunks is missing."}';
    }

    echo $output;
}

// Tell the browser to close the connection. (But leaving server to process what still needs to be done)
header( 'Connection: close' );

// Flush / send the output (buffer) now and turn off output buffering.
ob_end_flush();

// Close session when opened. This will help not to block other "async" request in some way.
if( session_id() ) session_write_close();