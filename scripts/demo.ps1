# Demostración funcional de StudySafe contra el servidor en ejecución (npm run dev).
# Uso (PowerShell):  .\scripts\demo.ps1
# Muestra [PASA] / [FALLA] por cada función importante del sistema.
param([string]$Base = "http://localhost:5000/api")

$script:ok = 0; $script:fallo = 0
$id = Get-Random -Minimum 10000 -Maximum 99999

function Llamar($metodo, $ruta, $cuerpo = $null, $token = $null) {
  $h = @{}
  if ($token) { $h["Authorization"] = "Bearer $token" }
  $params = @{ Uri = "$Base$ruta"; Method = $metodo; Headers = $h; ContentType = "application/json; charset=utf-8" }
  if ($null -ne $cuerpo) { $params.Body = [System.Text.Encoding]::UTF8.GetBytes(($cuerpo | ConvertTo-Json -Depth 5)) }
  try {
    $r = Invoke-RestMethod @params
    return @{ status = 200; datos = $r }
  } catch {
    $codigo = 0
    if ($_.Exception.Response) { $codigo = [int]$_.Exception.Response.StatusCode }
    return @{ status = $codigo; datos = $null }
  }
}

function Verificar($nombre, $condicion) {
  if ($condicion) { Write-Host "[PASA ] $nombre" -ForegroundColor Green; $script:ok++ }
  else { Write-Host "[FALLA] $nombre" -ForegroundColor Red; $script:fallo++ }
}

function NuevoUsuario($n) {
  @{ alias = "demo$($n)_$id"; email_institucional = "demo$($n)_$id@unicauca.edu.co"
     nombre_real = "Usuario Demo $n"; documento_identidad = "9$id$n"; password = "Clave12345" }
}

Write-Host "`n=== 1. REGISTRO Y LOGIN ===" -ForegroundColor Cyan
$v = NuevoUsuario 1; $c = NuevoUsuario 2
Verificar "Registrar vendedor" ((Llamar Post "/auth/registro" $v).status -eq 200)
Verificar "Registrar comprador" ((Llamar Post "/auth/registro" $c).status -eq 200)
$mal = NuevoUsuario 3; $mal.email_institucional = "intruso@gmail.com"
Verificar "Rechaza correo no institucional" ((Llamar Post "/auth/registro" $mal).status -eq 400)
Verificar "Rechaza registro duplicado" ((Llamar Post "/auth/registro" $v).status -eq 409)
$lv = Llamar Post "/auth/login" @{ email_institucional = $v.email_institucional; password = $v.password }
$lc = Llamar Post "/auth/login" @{ email_institucional = $c.email_institucional; password = $c.password }
Verificar "Login vendedor devuelve token" ($lv.status -eq 200 -and $lv.datos.token)
Verificar "Rechaza contraseña incorrecta" ((Llamar Post "/auth/login" @{ email_institucional = $v.email_institucional; password = "incorrecta1" }).status -eq 401)
$tv = $lv.datos.token; $tc = $lc.datos.token

Write-Host "`n=== 2. PUBLICAR Y CONSULTAR MATERIALES ===" -ForegroundColor Cyan
$mat = @{ titulo = "Parcial 1 Algoritmos"; descripcion = "Solucionario completo"; materia = "Algoritmos"
          profesor = "Ana Maria Gomez"; tipo = "Parcial"; precio = 2000; archivo_url = "https://drive.google.com/doc1" }
Verificar "Publicar sin token es rechazado" ((Llamar Post "/feed/publicar" $mat).status -eq 401)
$pub = Llamar Post "/feed/publicar" $mat $tv
Verificar "Publicar material con token" ($pub.status -eq 200 -and $pub.datos.exito)
$idMat = $pub.datos.material._id
$malo = $mat.Clone(); $malo.precio = "abc"
Verificar "Rechaza precio inválido" ((Llamar Post "/feed/publicar" $malo $tv).status -eq 400)
$feed = Llamar Get "/feed"
Verificar "El feed es público y lista materiales" ($feed.status -eq 200 -and $feed.datos.total -ge 1)
Verificar "El feed NO expone el archivo de pago" (($feed.datos | ConvertTo-Json -Depth 6) -notmatch "drive.google.com")

Write-Host "`n=== 3. BILLETERA, COMPRA Y ACCESO ===" -ForegroundColor Cyan
Verificar "Archivo de pago bloqueado sin comprar" ((Llamar Get "/feed/$idMat/archivo" $null $tc).status -eq 403)
Verificar "Compra sin saldo es rechazada" ((Llamar Post "/transacciones/comprar/$idMat" $null $tc).status -eq 402)
Verificar "Rechaza recarga negativa" ((Llamar Post "/transacciones/recargar" @{ monto = -5000 } $tc).status -eq 400)
$rec = Llamar Post "/transacciones/recargar" @{ monto = 5000 } $tc
Verificar "Recarga de 5000 suma al saldo" ($rec.status -eq 200 -and $rec.datos.saldo -eq 5000)
$compra = Llamar Post "/transacciones/comprar/$idMat" $null $tc
Verificar "Compra exitosa descuenta 2000 (saldo 3000)" ($compra.status -eq 200 -and $compra.datos.saldo -eq 3000)
Verificar "Tras comprar, accede al archivo" ((Llamar Get "/feed/$idMat/archivo" $null $tc).status -eq 200)
Verificar "No se puede comprar dos veces" ((Llamar Post "/transacciones/comprar/$idMat" $null $tc).status -eq 409)
$hist = Llamar Get "/transacciones/historial" $null $tc
Verificar "Historial muestra 2 movimientos" ($hist.status -eq 200 -and $hist.datos.total -eq 2)

Write-Host "`n=== 4. PERMISOS: EDITAR Y ELIMINAR ===" -ForegroundColor Cyan
Verificar "Otro usuario NO puede eliminar" ((Llamar Delete "/feed/$idMat" $null $tc).status -eq 403)
Verificar "El autor edita su material" ((Llamar Put "/feed/$idMat" @{ precio = 2500 } $tv).status -eq 200)
Verificar "El autor elimina su material" ((Llamar Delete "/feed/$idMat" $null $tv).status -eq 200)
Verificar "El material ya no existe" ((Llamar Get "/feed/$idMat").status -eq 404)

Write-Host "`n=== RESULTADO: $script:ok pasan, $script:fallo fallan ===" -ForegroundColor $(if ($script:fallo -eq 0) { "Green" } else { "Yellow" })
