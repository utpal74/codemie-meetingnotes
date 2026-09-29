param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

$ErrorActionPreference = 'Stop'

if ([System.IO.Path]::GetExtension($Path) -ne '.docx') {
    throw 'The requirements source must be a .docx file.'
}

$resolvedPath = Resolve-Path -LiteralPath $Path
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($resolvedPath.Path)

try {
    $documentEntry = $archive.GetEntry('word/document.xml')
    if ($null -eq $documentEntry) {
        throw 'The file is not a valid Word document: word/document.xml is missing.'
    }

    $reader = [System.IO.StreamReader]::new($documentEntry.Open())
    try {
        [xml]$document = $reader.ReadToEnd()
    }
    finally {
        $reader.Dispose()
    }

    $namespaces = [System.Xml.XmlNamespaceManager]::new($document.NameTable)
    $namespaces.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
    $paragraphs = $document.SelectNodes('//w:body//w:p', $namespaces)

    foreach ($paragraph in $paragraphs) {
        $runs = $paragraph.SelectNodes('.//w:t', $namespaces)
        $text = ($runs | ForEach-Object { $_.InnerText }) -join ''
        if (-not [string]::IsNullOrWhiteSpace($text)) {
            $text
        }
    }
}
finally {
    $archive.Dispose()
}